import { client, db } from '.'
import { goalCompletions, goals } from './schema'

async function seed() {
  await db.delete(goalCompletions)
  await db.delete(goals)

  const result = await db
    .insert(goals)
    .values([
      { title: 'Me alongar', desiredWeeklyFrequency: 7 },
      { title: 'Correr', desiredWeeklyFrequency: 4 },
      { title: 'Ler 10 páginas', desiredWeeklyFrequency: 5 },
      { title: 'Terapia', desiredWeeklyFrequency: 1 },
    ])
    .returning()

  await db
    .insert(goalCompletions)
    .values([{ goalId: result[3].id, createdAt: new Date() }])
}

seed().finally(() => {
  client.end()
})
