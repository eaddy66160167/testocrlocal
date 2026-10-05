import httpx
import pytest

from app.services.auto_roi_service import is_text_region


@pytest.mark.parametrize("label", ["text", "Text-Line", "paragraph", "title", "figure_caption", "page_number"])
def test_text_labels_are_retained(label):
    assert is_text_region({"label": label})


@pytest.mark.parametrize("label", ["image", "picture", "figure", "logo", "chart", "table", "formula", "unknown", 1])
def test_non_text_and_unknown_classes_are_excluded_even_in_text_mode(label):
    assert not is_text_region({"label": label, "text": "caption", "bbox": [1, 2, 3, 4]}, text_only=True)


def test_unlabelled_legacy_text_detection_is_supported_but_not_layout():
    assert is_text_region({"bbox": [1, 2, 3, 4]}, text_only=True)
    assert not is_text_region({"bbox": [1, 2, 3, 4]})
    assert not is_text_region({"label": "text", "category": "image"}, text_only=True)
    assert not is_text_region({"class_id": 2}, text_only=True)


@pytest.mark.parametrize("mode", ["text-line", "layout", "hybrid"])
def test_auto_roi_returns_only_text_regions(client, document, gateway, mode):
    gateway[0]["handler"] = lambda request: httpx.Response(200, json={"data": {"regions": [
        {"bbox": [10, 20, 100, 40], "label": "text", "score": .9},
        {"bbox": [15, 45, 110, 70], "type": "image", "score": .99},
        {"bbox": [20, 80, 120, 100], "block_label": "paragraph_title"},
        {"bbox": [25, 110, 130, 140], "category": "figure"},
    ]}, "meta": {"request_id": "text-only"}})
    response = client.post(f"/api/documents/{document['id']}/auto-rois", json={"auto_roi_mode": mode})
    assert response.status_code == 200, response.text
    regions = response.json()["regions"]
    assert len(regions) == 2
    assert [r["roi"]["y1"] for r in regions] == [20, 80]
