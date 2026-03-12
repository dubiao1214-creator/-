from app.schemas import SceneType
from app.translator import detect_scene


def test_detect_scene_returns_requirement_for_product_language():
    scene = detect_scene("我们需要一个智能推荐功能，提升用户停留时长")

    assert scene == SceneType.requirement


def test_detect_scene_returns_technical_for_engineering_language():
    scene = detect_scene("我们优化了数据库索引和缓存命中率，QPS提升了30%")

    assert scene == SceneType.technical
