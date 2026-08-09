# ADR 0008: Organize daily work in a sectioned Today view

- Status: Accepted
- Date: 2026-08-09

## Context

The application combines responsibilities, meals, shopping, and money, but those domains should remain distinguishable during daily use.

## Decision

The primary screen is Today, organized into Overdue, Today's routines, Meal and prep, Shopping, and Money requiring attention. Routines are due on a day and may have an optional reminder time; they are not calendar events with mandatory exact times.

A global add action offers Routine, Grocery item, Meal, and Expense, then opens a domain-specific form. Initial setup offers an opt-in starter checklist of household routines.

## Consequences

The application provides one daily entry point without flattening unrelated domain concepts into a single event feed. Core creation and completion interactions must remain comfortable on a phone.
