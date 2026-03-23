#!/usr/bin/env python3
"""Trivia question generation pipeline CLI."""

import argparse

from config import CONFIDENCE_THRESHOLD, DB_PATH, EXPORT_PATH, MODEL_NAME


def cmd_generate(args: argparse.Namespace) -> None:
    from phases.generate import run_generate

    run_generate(
        db_path=args.db,
        limit=args.limit,
        model_name=args.model,
        restart_every=args.restart_every,
    )


def cmd_validate(args: argparse.Namespace) -> None:
    from phases.validate import run_validate

    run_validate(db_path=args.db, model_name=args.model, limit=args.limit)


def cmd_verify(args: argparse.Namespace) -> None:
    from phases.verify import run_verify

    run_verify(db_path=args.db, threshold=args.threshold)


def cmd_review(args: argparse.Namespace) -> None:
    from phases.review import run_review

    run_review(db_path=args.db)


def cmd_curate(args: argparse.Namespace) -> None:
    from phases.curate import run_curate

    run_curate(db_path=args.db)


def cmd_dupes(args: argparse.Namespace) -> None:
    from phases.dupes import run_dupes

    run_dupes(db_path=args.db)


def cmd_export(args: argparse.Namespace) -> None:
    from phases.export import run_export

    run_export(db_path=args.db, output_path=args.output)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Trivia question generation pipeline",
    )
    parser.add_argument(
        "--db",
        default=str(DB_PATH),
        help=f"Path to generation database (default: {DB_PATH})",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # ── generate ────────────────────────────────────────────────────────────
    gen_p = subparsers.add_parser("generate", help="Generate questions via LLM")
    gen_p.add_argument("--limit", type=int, default=None, help="Max source chunks to process")
    gen_p.add_argument("--model", default=MODEL_NAME, help="MLX model name or path")
    gen_p.add_argument("--restart-every", type=int, default=None, metavar="N", help="Reload model every N chunks to prevent degradation")
    gen_p.set_defaults(func=cmd_generate)

    # ── validate ────────────────────────────────────────────────────────────
    val_p = subparsers.add_parser("validate", help="LLM self-validation of generated questions")
    val_p.add_argument("--model", default=MODEL_NAME, help="MLX model name or path")
    val_p.add_argument("--limit", type=int, default=None, help="Max questions to validate")
    val_p.set_defaults(func=cmd_validate)

    # ── verify ──────────────────────────────────────────────────────────────
    ver_p = subparsers.add_parser("verify", help="Deduplicate and score confidence")
    ver_p.add_argument(
        "--threshold",
        type=float,
        default=CONFIDENCE_THRESHOLD,
        help=f"Confidence cutoff for auto-approval (default: {CONFIDENCE_THRESHOLD})",
    )
    ver_p.set_defaults(func=cmd_verify)

    # ── review ──────────────────────────────────────────────────────────────
    rev_p = subparsers.add_parser("review", help="Interactively review low-confidence questions")
    rev_p.set_defaults(func=cmd_review)

    # ── dupes ───────────────────────────────────────────────────────────────
    dup_p = subparsers.add_parser("dupes", help="Review and override false-positive duplicates")
    dup_p.set_defaults(func=cmd_dupes)

    # ── curate ──────────────────────────────────────────────────────────────
    cur_p = subparsers.add_parser("curate", help="Human review of all unreviewed valid questions")
    cur_p.set_defaults(func=cmd_curate)

    # ── export ──────────────────────────────────────────────────────────────
    exp_p = subparsers.add_parser("export", help="Export verified questions to app DB")
    exp_p.add_argument(
        "--output",
        default=str(EXPORT_PATH),
        help=f"Output path for export database (default: {EXPORT_PATH})",
    )
    exp_p.set_defaults(func=cmd_export)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
