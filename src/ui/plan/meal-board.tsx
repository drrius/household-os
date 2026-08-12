import Link from "next/link";

import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { Card } from "@/ui/primitives/card";
import { StatusPill } from "@/ui/primitives/status-pill";

import styles from "./meal-board.module.css";

type PlanDay = PlanViewModel["days"][number];
type PlanSlot = PlanDay["slots"][number];

type MealSlotProps = {
  dateLabel: string;
  mealSlot: PlanSlot;
};

function MealSlot({ dateLabel, mealSlot }: MealSlotProps) {
  const { entry, slot } = mealSlot;

  if (entry === null) {
    return (
      <li className={styles.slot}>
        <Link
          className={styles.emptySlot}
          href="/plan/meals/new"
          aria-label={`Add ${slot} on ${dateLabel}`}
        >
          + {slot}
        </Link>
      </li>
    );
  }

  return (
    <li className={styles.slot}>
      <Card
        className={styles.mealCard}
        tone={entry.isLeftover ? "warning" : "meal"}
        header={
          <>
            <span className={styles.slotName}>{slot}</span>
            {entry.isLeftover ? (
              <StatusPill tone="warning">Leftover</StatusPill>
            ) : null}
          </>
        }
      >
        <div className={styles.mealDetails}>
          <h3>{entry.title}</h3>
          {entry.notes !== null ? <p>{entry.notes}</p> : null}
          {entry.cookLabel !== null ? (
            <p className={styles.cookLabel}>{entry.cookLabel}</p>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

function DayColumn({ day }: { day: PlanDay }) {
  const dateLabel = formatZurichDayLabel(day.date);
  const classes = [styles.day, day.isToday ? styles.today : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes} aria-labelledby={`plan-day-${day.date}`}>
      <header className={styles.dayHeader}>
        <h2 id={`plan-day-${day.date}`}>
          <time dateTime={day.date} title={dateLabel}>
            {day.weekdayLabel}
          </time>
        </h2>
        {day.isToday ? <StatusPill tone="accent">Today</StatusPill> : null}
      </header>
      <ul className={styles.slots}>
        {day.slots.map((mealSlot) => (
          <MealSlot
            key={mealSlot.slot}
            dateLabel={dateLabel}
            mealSlot={mealSlot}
          />
        ))}
      </ul>
    </article>
  );
}

export function MealBoard({ days }: { days: PlanViewModel["days"] }) {
  return (
    <section aria-labelledby="meal-board-title">
      <h2 id="meal-board-title" className="u-visually-hidden">
        Monday to Sunday meal board
      </h2>
      <Card className={styles.boardCard}>
        <div className={styles.boardViewport}>
          <div className={styles.board}>
            {days.map((day) => (
              <DayColumn key={day.date} day={day} />
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}
