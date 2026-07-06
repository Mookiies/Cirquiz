"""Pydantic schemas for Outlines structured LLM output."""

import sys
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import CategoryLiteral  # noqa: E402


class GeneratedQuestion(BaseModel):
    text: str = Field(description="The trivia question text")
    correct_answer: str = Field(description="The single correct answer")
    distractor_1: str = Field(description="A plausible but incorrect answer")
    distractor_2: str = Field(description="A plausible but incorrect answer")
    distractor_3: str = Field(description="A plausible but incorrect answer")
    category: CategoryLiteral = Field(description="The most accurate category for this question")
    difficulty: Literal["easy", "medium", "hard"] = Field(
        description=(
            "Rate difficulty from the perspective of a player with NO passage context — "
            "only the question itself. "
            "easy = ~70%+ of adults would know (continents, globally famous people, major world events); "
            "medium = ~20–70% would know with casual interest in the topic (country capitals, specific decades, notable but not A-list figures); "
            "hard = fewer than ~20% would know even with general interest (exact dates, city-level facts, minor figures, technical specifics). "
            "When uncertain, rate harder rather than easier."
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


class QuestionValidation(BaseModel):
    is_valid: bool = Field(
        description=(
            "True if this is a clear, unambiguous trivia question with a definitively correct "
            "answer and three plausible but clearly wrong distractors. False if the question is "
            "ambiguous, factually wrong, too easy to guess, the correct answer appears in the "
            "wrong answers, the correct answer is structurally distinguishable from the other "
            "options by its format or type alone (e.g. the only compound answer, the only plural, "
            "the only name when others are places, etc.), the question references 'the passage', "
            "'the text', 'the article', or similar — questions must stand alone without source material, "
            "or the question requires the player to know specific values/data from the source passage "
            "or to perform a calculation — trivia answers must be recalled world facts, not computed results."
        )
    )
    difficulty: Literal["easy", "medium", "hard"] = Field(
        description=(
            "Assess difficulty as if the player is a random adult with NO access to the passage, "
            "image, or any related context — only the question and answer choices. "
            "Use this specificity + population framework: "
            "easy = broad scope, ~70%+ of adults would know without studying — "
            "continent-level geography, globally famous people, major world events, "
            "e.g. 'What continent is Switzerland in?' or 'Who wrote Romeo and Juliet?'; "
            "medium = country/regional scope or requires genuine interest in the topic — "
            "~20–70% of adults with casual interest would know, "
            "e.g. 'What is the capital of Switzerland?' or 'Which decade did disco emerge?'; "
            "hard = city/town level, exact dates, minor figures, technical specifics — "
            "fewer than ~20% of adults would know even with general interest in the topic, "
            "e.g. 'When is Swiss National Day?' or 'What year did Switzerland join the UN?' "
            "When in doubt, rate harder rather than easier — underestimating difficulty is worse."
        )
    )
    category: CategoryLiteral = Field(description="The most accurate category for this question")
    answer_in_question: bool = Field(
        description=(
            "True if the question text itself reveals or strongly implies the correct answer. "
            "Example: 'Who developed Adobe Illustrator?' with answer 'Adobe' — the answer is "
            "in the question. This should cause is_valid to be False."
        )
    )
    rejection_reason: str = Field(
        description=(
            "If is_valid is False, a brief reason why (e.g. 'ambiguous question', "
            "'correct answer appears in distractors', 'answer revealed in question text', "
            "'format asymmetry — correct answer is the only compound/plural option', "
            "'factually incorrect'). Empty string if is_valid is True."
        )
    )
