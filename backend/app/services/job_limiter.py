"""Runs CPU-heavy jobs one at a time, with a bounded queue and a time limit.

A running Python thread cannot be killed, so a job past its deadline keeps its
slot until it stops. Jobs receive the deadline and check it between steps,
which is what actually frees the slot.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable
from functools import partial
from typing import TypeVar

T = TypeVar("T")

_DISCONNECT_POLL_SECONDS = 0.5


class ServerBusyError(Exception):
    """The queue is full, or the wait for a slot ran out."""


class JobTimeoutError(Exception):
    """A job passed its time limit."""


class ClientGoneError(Exception):
    """The client left while waiting, so there is nobody to do the work for."""


class JobLimiter:
    def __init__(
        self, concurrency: int, max_queued: int, queue_seconds: float, timeout_seconds: float
    ) -> None:
        self._slots = asyncio.Semaphore(concurrency)
        self._max_queued = max_queued
        self._queue_seconds = queue_seconds
        self._timeout_seconds = timeout_seconds
        self._queued = 0

    async def _wait_for_slot(self, client_gone: Callable[[], Awaitable[bool]]) -> None:
        if self._queued >= self._max_queued:
            raise ServerBusyError
        self._queued += 1
        give_up_at = time.monotonic() + self._queue_seconds
        try:
            while True:
                try:
                    await asyncio.wait_for(self._slots.acquire(), _DISCONNECT_POLL_SECONDS)
                    return
                except TimeoutError:
                    # Slider moves abandon earlier requests; those must not run.
                    if await client_gone():
                        raise ClientGoneError from None
                    if time.monotonic() >= give_up_at:
                        raise ServerBusyError from None
        finally:
            self._queued -= 1

    async def run(
        self, job: Callable[[float], T], client_gone: Callable[[], Awaitable[bool]]
    ) -> T:
        """Run ``job(deadline)`` in a worker thread; ``deadline`` is on the monotonic clock."""
        await self._wait_for_slot(client_gone)

        loop = asyncio.get_running_loop()
        deadline = time.monotonic() + self._timeout_seconds
        try:
            future = loop.run_in_executor(None, partial(job, deadline))
        except BaseException:
            self._slots.release()
            raise
        # The slot is held until the thread really ends, even after a timeout.
        future.add_done_callback(lambda _: self._slots.release())
        try:
            return await asyncio.wait_for(asyncio.shield(future), self._timeout_seconds)
        except TimeoutError:
            # The thread may still fail later; nobody is left to read that.
            future.add_done_callback(lambda done: done.cancelled() or done.exception())
            raise JobTimeoutError from None
