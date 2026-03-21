"""Pydantic schemas for Outlines structured LLM output."""

from typing import Literal

from pydantic import BaseModel, Field


class GeneratedQuestion(BaseModel):
    text: str = Field(description="The trivia question text")
    correct_answer: str = Field(description="The single correct answer")
    distractor_1: str = Field(description="A plausible but incorrect answer")
    distractor_2: str = Field(description="A plausible but incorrect answer")
    distractor_3: str = Field(description="A plausible but incorrect answer")
    difficulty: Literal["easy", "medium", "hard"] = Field(
        description=(
            "easy = commonly known facts; "
            "medium = requires specific knowledge; "
            "hard = obscure or requires deep expertise"
        )
    )
    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "How confident you are that this question is factually accurate "
            "and grounded in the provided source text (0.0–1.0)"
        ),
    )


class GeneratedQuestionBatch(BaseModel):
    questions: list[GeneratedQuestion] = Field(
        description="List of generated trivia questions from the source passage"
    )
