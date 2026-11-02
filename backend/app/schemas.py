from pydantic import BaseModel


class ImageMetadata(BaseModel):
    filename: str
    format: str
    mime_type: str
    width: int
    height: int
    pixel_count: int
    size_bytes: int
    has_alpha: bool
