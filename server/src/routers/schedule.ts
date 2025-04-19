import { nan, z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { YankiConnect } from 'yanki-connect';
import {
  StudyScheduleInputSchema,
  StudyScheduleUpdateSchema,
  StudyScheduleSchema,
  StudyLogInputSchema,
  StudyLogUpdateSchema,
  StudyLogSchema,
  TimelineEventSchema,
  YearlyLogSchema,
  StudySchedule
} from '@answeranki/shared/schemas/schedule';
import { nanoid } from 'nanoid';
import { toStringAnkiQuery } from '../utils.js';

const ankiConnect = new YankiConnect();

export const scheduleRouter = router({
  listSchedules: publicProcedure
    .output(z.array(StudyScheduleSchema))
    .query(async () => {
      // Ankiから"Meta"デッキのノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:schedule'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // ノート情報からスケジュールデータを抽出
      const schedules = notesInfo.map(note => {
        // Infoフィールドからスケジュールデータを取得し、zodで検証
        const scheduleData = StudyScheduleSchema.parse(JSON.parse(note.fields.Info.value));
        // Ankiノート情報を追加
        scheduleData.anki_note_id = note.noteId;
        return scheduleData;
      });
      
      // 開始日でソート
      schedules.sort((a, b) => {
        const dateA = new Date(a.start_date);
        const dateB = new Date(b.start_date);
        return dateA.getTime() - dateB.getTime();
      });
      const s: StudySchedule[] = schedules;
      z.array(StudyScheduleSchema).parse(schedules);
      return schedules;
    }),

  createSchedule: publicProcedure
    .input(StudyScheduleInputSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      // テキストブック情報をAnkiから取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:textbook ${toStringAnkiQuery(`"id":"${input.textbook_id}"`)}`
      });
      
      console.log(noteIds)
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: [noteIds[0]]
      });
      
      // テキストブックデータをzodで検証
      const textbookSchema = z.object({
        title: z.string(),
        subject: z.string()
      });
      const textbookData = textbookSchema.parse(JSON.parse(notesInfo[0].fields.Info.value));
      const textbookTitle = textbookData.title;
      const textbookSubject = textbookData.subject;
      
      // スケジュールデータを作成
      const scheduleData: StudySchedule = {
        id: nanoid(),
        textbook_id: input.textbook_id,
        textbook_title: textbookTitle,
        textbook_subject: textbookSubject,
        start_date: input.start_date,
        end_date: input.end_date,
        daily_goal: input.daily_goal,
        buffer_days: input.buffer_days,
        weekday_goals: input.weekday_goals,
        total_problems: input.total_problems,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // スケジュールデータをJSON形式に変換
      const scheduleJson = JSON.stringify(scheduleData);
      
      // Ankiに保存
      await ankiConnect.note.addNote({
        note: {
          deckName: "Meta",
          modelName: "MetaData",
          fields: {
            Info: scheduleJson
          },
          tags: ["schedule", textbookSubject]
        }
      });

      return StudyScheduleSchema.parse(scheduleData);
    }),

  updateSchedule: publicProcedure
    .input(StudyScheduleUpdateSchema)
    .output(StudyScheduleSchema)
    .mutation(async ({ input }) => {
      // テキストブック情報をAnkiから取得
      const textbookNoteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:textbook ${toStringAnkiQuery(`"id":"${input.textbook_id}"`)}`
      });
      
      let textbookTitle;
      let textbookSubject;
      
      const textbookNotesInfo = await ankiConnect.note.notesInfo({
        notes: [textbookNoteIds[0]]
      });
      
      // テキストブックデータをzodで検証
      const textbookSchema = z.object({
        title: z.string(),
        subject: z.string()
      });
      const textbookData = textbookSchema.parse(JSON.parse(textbookNotesInfo[0].fields.Info.value));
      textbookTitle = textbookData.title;
      textbookSubject = textbookData.subject;
      
      // スケジュールのAnkiノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:schedule ${toStringAnkiQuery(`"id":"${input.id}"`)}`
      });
      
      if (noteIds.length === 0) {
        throw new Error(`Schedule with ID ${input.id} not found in Anki`);
      }
      
      // 最初のノートを使用
      const noteId = noteIds[0];
      
      // 更新するスケジュールデータを作成
      const scheduleData: StudySchedule = {
        id: input.id,
        textbook_id: input.textbook_id,
        textbook_title: textbookTitle,
        textbook_subject: textbookSubject,
        start_date: input.start_date,
        end_date: input.end_date,
        daily_goal: input.daily_goal,
        buffer_days: input.buffer_days,
        weekday_goals: input.weekday_goals,
        total_problems: input.total_problems,
        updated_at: new Date(),
        anki_note_id: noteId
      };
      
      // スケジュールデータをJSON形式に変換
      const scheduleJson = JSON.stringify(scheduleData);
      
      // Ankiのノートを更新
      await ankiConnect.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {
            Info: scheduleJson
          }
        }
      });
      
      return StudyScheduleSchema.parse(scheduleData);
    }),

  deleteSchedule: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Ankiからノート情報を取得
      const noteIds = await ankiConnect.note.findNotes({
        query: `deck:"Meta" tag:schedule ${toStringAnkiQuery(`"id":"${input.id}"`)}`
      });
      
      if (noteIds.length > 0) {
        // ノートを削除
        await ankiConnect.note.deleteNotes({
          notes: noteIds
        });
      }
      
      return { success: true, message: 'Schedule deleted successfully' };
    }),

  // --- Study Log Procedures ---
  listLogs: publicProcedure
    .input(z.object({
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
        textbook_id: z.string().optional(),
    }).optional())
    .output(z.array(StudyLogSchema))
    .query(async ({ input }) => {
      // 現時点では学習ログデータはAnkiに保存されていないため、空の配列を返す
      // 将来的には、Ankiから学習ログデータを取得するように実装する必要がある
      return [];
    }),

  // --- Timeline Events Procedure ---
  getTimelineEvents: publicProcedure
    .input(z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
    }).optional())
    .output(z.array(TimelineEventSchema))
    .query(async ({ input }) => {
      // Array will hold fully parsed events
      const events: z.infer<typeof TimelineEventSchema>[] = [];
      const startDate = input?.startDate;
      const endDate = input?.endDate;

      // Ankiから"Meta::Schedule"デッキのノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:schedule'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // ノート情報からスケジュールデータを抽出
      const allSchedules = notesInfo.map(note => {
        // Infoフィールドからスケジュールデータを取得し、zodで検証
        const scheduleData = StudyScheduleSchema.parse(JSON.parse(note.fields.Info.value));
        // Ankiノート情報を追加
        scheduleData.anki_note_id = note.noteId;
        return scheduleData;
      });
      
      // 日付範囲でフィルタリング
      const filteredSchedules = allSchedules.filter(schedule => {
        const scheduleStartDate = new Date(schedule.start_date);
        const scheduleEndDate = new Date(schedule.end_date);
        
        if (startDate && scheduleEndDate < startDate) return false;
        if (endDate && scheduleStartDate > endDate) return false;
        
        return true;
      });
      
      // スケジュールデータをTimelineEventに変換
      filteredSchedules.forEach(schedule => {
        const rawEventData = {
          id: `schedule-${schedule.id}`,
          type: 'schedule' as const,
          title: `${schedule.textbook_subject}: ${schedule.textbook_title}`,
          startDate: new Date(schedule.start_date),
          endDate: new Date(schedule.end_date),
          details: schedule
        };
        events.push(TimelineEventSchema.parse(rawEventData));
      });

      events.sort((a, b) => {
          const startDiff = a.startDate.getTime() - b.startDate.getTime();
          if (startDiff !== 0) return startDiff;
          const endDateA = a.endDate?.getTime() ?? a.startDate.getTime();
          const endDateB = b.endDate?.getTime() ?? b.startDate.getTime();
          return endDateA - endDateB;
      });

      return events;
    }),

  getYearlyLogs: publicProcedure
    .input(z.object({ year: z.number().int() }))
    .output(z.array(YearlyLogSchema))
    .query(async ({ input }) => {
      // 現時点では学習ログデータはAnkiに保存されていないため、空の配列を返す
      // 将来的には、Ankiから学習ログデータを取得するように実装する必要がある
      return [];
    }),

  // 今日のタスク（スケジュールに基づくAnkiデッキ）を取得
  getTodaysTasks: publicProcedure
    .output(z.array(z.object({
      id: z.string(),
      textbook_id: z.string(),
      textbook_title: z.string(),
      textbook_subject: z.string(),
      anki_deck_name: z.string().nullable(),
      start_date: z.date(),
      end_date: z.date(),
      daily_goal: z.number().nullable(),
      buffer_days: z.number().nullable(),
      total_problems: z.number().nullable()
    })))
    .query(async () => {
      // 今日の日付を取得
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Ankiから"Meta"デッキのノートを検索
      const noteIds = await ankiConnect.note.findNotes({
        query: 'deck:"Meta" tag:schedule'
      });
      
      // 各ノートの詳細情報を取得
      const notesInfo = await ankiConnect.note.notesInfo({
        notes: noteIds
      });
      
      // ノート情報からスケジュールデータを抽出
      const allSchedules = notesInfo.map(note => {
        // Infoフィールドからスケジュールデータを取得し、zodで検証
        const scheduleData = StudyScheduleSchema.parse(JSON.parse(note.fields.Info.value));
        // Ankiノート情報を追加
        scheduleData.anki_note_id = note.noteId;
        return scheduleData;
      });
      
      // 今日のスケジュールをフィルタリング（開始日 <= 今日 <= 終了日）
      const todaySchedules = allSchedules.filter(schedule => {
        const startDate = new Date(schedule.start_date);
        const endDate = new Date(schedule.end_date);
        return startDate <= today && endDate >= today;
      });

      
      // 必要なデータを整形して返す（参考書のAnkiデッキ名を取得）
      const result = await Promise.all(todaySchedules.map(async (schedule) => {
        let deckName: string | null = null;
        try {
          const tbNoteIds = await ankiConnect.note.findNotes({
            query: 'deck:"Meta" tag:textbook ' + toStringAnkiQuery(`"id":"${schedule.textbook_id}"`)
          });
          if (tbNoteIds.length > 0) {
            const tbNotesInfo = await ankiConnect.note.notesInfo({ notes: [tbNoteIds[0]] });
            const tbData = JSON.parse(tbNotesInfo[0].fields.Info.value);
            deckName = tbData.anki_deck_name ?? null;
          }
        } catch (e) {
          console.warn('Failed to fetch textbook Anki deck name for', schedule.textbook_id, e);
        }
        return {
          id: schedule.id,
          textbook_id: schedule.textbook_id,
          textbook_title: schedule.textbook_title,
          textbook_subject: schedule.textbook_subject,
          anki_deck_name: deckName,
          start_date: new Date(schedule.start_date),
          end_date: new Date(schedule.end_date),
          daily_goal: schedule.daily_goal ?? null,
          buffer_days: schedule.buffer_days ?? null,
          total_problems: schedule.total_problems ?? null,
        };
      }));
      return result;
    }),
});

export type ScheduleRouter = typeof scheduleRouter;
