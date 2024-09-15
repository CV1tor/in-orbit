import { and, count, gte, lte, eq, sql, desc } from 'drizzle-orm'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'
import dayjs from 'dayjs'

export async function getWeekSummary() {
  const firstDayOfWeek = dayjs().startOf('week').toDate()
  const lastDayOfWeek = dayjs().endOf('week').toDate()

  const goalsCreatedUpToWeek = db.$with('goals_created_up_to_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createdAt: goals.createdAt,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayOfWeek))
  )

  const goalsCompletedOnWeek = db.$with('goal_completion_counts').as(
    db
      .select({
        id: goalCompletions.id,
        title: goals.title,
        completedAt: goalCompletions.createdAt,
        completedAtDate: sql`DATE(${goalCompletions.createdAt})`.as(
          'completedAtDate'
        ),
      })
      .from(goalCompletions)
      .innerJoin(goals, eq(goals.id, goalCompletions.goalId))
      .where(
        and(
          gte(goalCompletions.createdAt, firstDayOfWeek),
          lte(goalCompletions.createdAt, lastDayOfWeek)
        )
      )
      .orderBy(desc(goalCompletions.createdAt))
  )

  const goalsCompletedByWeekDay = db.$with('goals_completed_in_week').as(
    db
      .select({
        completedAtDate: goalsCompletedOnWeek.completedAtDate,
        completions: sql`
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', ${goalsCompletedOnWeek.id},
                        'title', ${goalsCompletedOnWeek.title},
                        'completedAt', ${goalsCompletedOnWeek.completedAt}
                    )
                )
            `.as('completions'),
      })
      .from(goalsCompletedOnWeek)
      .groupBy(goalsCompletedOnWeek.completedAtDate)
      .orderBy(desc(goalsCompletedOnWeek.completedAtDate))
  )

  type GoalsPerDay = Record<
    string,
    {
      id: string
      title: string
      completedAt: string
    }[]
  >

  const result = await db
    .with(goalsCreatedUpToWeek, goalsCompletedOnWeek, goalsCompletedByWeekDay)
    .select({
      completed: sql`(SELECT COUNT(*) FROM ${goalsCompletedOnWeek})`
        .mapWith(Number)
        .as('completed'),
      total:
        sql`(SELECT SUM(${goalsCreatedUpToWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpToWeek})`
          .mapWith(Number)
          .as('total'),
      goalsPerDay: sql<GoalsPerDay>`JSON_OBJECT_AGG(
        ${goalsCompletedByWeekDay.completedAtDate},
        ${goalsCompletedByWeekDay.completions}  
      )`.as('goalsPerDay'),
    })
    .from(goalsCompletedByWeekDay)

  return {
    summary: result[0],
  }
}
