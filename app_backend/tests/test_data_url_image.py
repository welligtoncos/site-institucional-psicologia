import base64

from app.core.data_url_image import parse_data_url_image


def test_parse_jpeg_data_url() -> None:
    raw = b"\xff\xd8\xff\xd9"
    payload = base64.b64encode(raw).decode("ascii")
    s = f"data:image/jpeg;base64,{payload}"
    out = parse_data_url_image(s)
    assert out is not None
    content, mime = out
    assert content == raw
    assert mime == "image/jpeg"


def test_parse_non_data_returns_none() -> None:
    assert parse_data_url_image("https://example.com/a.jpg") is None
