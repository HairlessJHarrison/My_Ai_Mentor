# Unplugged — OpenClaw Skill

## Overview

This skill lets OpenClaw manage the Unplugged household data platform. It exposes 20 tools covering schedules, meals, budgets, scoring, presence sessions, and configuration.

## Installation

1. Copy this directory into your OpenClaw skills folder
2. Set the `UNPLUGGED_API_KEY` environment variable in your OpenClaw config
3. Update `base_url` in `skill.json` if your Unplugged instance is not at `http://localhost/api/v1`

## Available Tools

| Tool | Description |
|------|-------------|
| `get_today_schedule` | Today's events + free blocks |
| `get_week_schedule` | Weekly schedule overview |
| `get_free_blocks` | Available time windows |
| `create_schedule_event` | Create a new event |
| `get_meal_plan` | Current week's meal plan |
| `create_meal_plan` | Add a meal to the plan |
| `get_grocery_list` | Consolidated grocery list |
| `get_budget_summary` | Monthly budget vs actuals |
| `log_transaction` | Log a financial transaction |
| `get_spending_forecast` | Projected month-end spending |
| `log_activity` | Log a scored family activity |
| `get_today_score` | Today's presence points |
| `get_score_trends` | Weekly score trends |
| `get_streaks` | Active activity streaks |
| `start_unplugged_session` | Begin screen-free session |
| `end_unplugged_session` | End session + auto-score |
| `get_presence_stats` | Unplugged statistics |
| `get_household_config` | Household configuration |
| `update_household_config` | Update config/narrative |
| `get_model_schemas` | All JSON Schemas |

## Example Usage

```
OpenClaw, check if we have any free time this weekend for an outdoor activity.
```

OpenClaw will call `get_free_blocks` with `days=7`, analyze the results, and suggest optimal times.
