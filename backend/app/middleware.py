"""Outermost protection inside CORS, so every refusal still reaches the browser."""

import json
import logging

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)


def _json_response(status: int, code: str, message: str) -> tuple[Message, Message]:
    body = json.dumps({"detail": {"code": code, "message": message}}).encode()
    start: Message = {
        "type": "http.response.start",
        "status": status,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ],
    }
    return start, {"type": "http.response.body", "body": body}


class RequestGuardMiddleware:
    """Refuses oversized bodies before they are parsed, and turns crashes into JSON.

    Content-Length is checked first; bodies without one, or that lie about it,
    are counted as they arrive. Unexpected errors become a plain JSON 500, so
    the browser gets a readable message with CORS headers instead of an opaque
    network failure.
    """

    def __init__(self, app: ASGIApp, max_body_bytes: int, too_large_message: str) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes
        self.too_large_message = too_large_message

    async def _refuse(self, send: Send) -> None:
        start, body = _json_response(413, "file_too_large", self.too_large_message)
        await send(start)
        await send(body)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_body_bytes:
            await self._refuse(send)
            return

        received = 0
        over_limit = False
        response_started = False

        async def counted_receive() -> Message:
            nonlocal received, over_limit
            if over_limit:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    over_limit = True
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message: Message) -> None:
            nonlocal response_started
            if over_limit:
                return  # The app is answering a body we cut off; ours goes out below.
            response_started = True
            await send(message)

        try:
            await self.app(scope, counted_receive, guarded_send)
        except Exception:
            if not over_limit:
                logger.exception("Unhandled error on %s", scope.get("path"))
            if response_started:
                raise
            if not over_limit:
                start, body = _json_response(
                    500, "server_error", "Something went wrong on the server. Please try again."
                )
                await send(start)
                await send(body)
                return
        if over_limit and not response_started:
            await self._refuse(send)
