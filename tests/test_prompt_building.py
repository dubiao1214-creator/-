from app.prompts import DEV_TO_PM_SYSTEM_PROMPT, PM_TO_DEV_SYSTEM_PROMPT
from app.schemas import Direction
from app.translator import build_messages


def test_build_messages_uses_pm_to_dev_prompt_and_template():
    messages = build_messages(
        direction=Direction.pm_to_dev,
        text="我们需要一个智能推荐功能，提升用户停留时长",
    )

    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == PM_TO_DEV_SYSTEM_PROMPT
    assert messages[1]["role"] == "user"
    assert "请把下面这段产品需求翻译给开发团队" in messages[1]["content"]
    assert "我们需要一个智能推荐功能" in messages[1]["content"]


def test_build_messages_uses_dev_to_pm_prompt_and_template():
    messages = build_messages(
        direction=Direction.dev_to_pm,
        text="我们优化了数据库查询，QPS提升了30%",
    )

    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == DEV_TO_PM_SYSTEM_PROMPT
    assert messages[1]["role"] == "user"
    assert "请把下面这段技术描述翻译给产品团队" in messages[1]["content"]
    assert "QPS提升了30%" in messages[1]["content"]
