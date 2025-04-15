// yanki-connect.d.ts

declare module 'yanki-connect'
{
    export type CardInfo = {
        answer: string;
        buttons?: number[];
        cardId: number;
        css: string;
        deckName: string;
        due: number;
        fieldOrder: number;
        fields: Record<string, {
            order: number;
            value: string;
        }>;
        interval: number;
        lapses: number;
        left: number;
        mod: number;
        modelName: string;
        nextReviews: string[];
        note: number;
        ord: number;
        question: string;
        queue: number;
        reps: number;
        template: string;
        type: number;
    }

    export type NoteModel = 'Basic' | 'Basic (and reversed card)' | 'Basic (type in the answer)' | 'Cloze' | (string & {});

    export type NoteMedia = {
        data?: string;
        fields: string[];
        path?: string;
        skipHash?: false;
        url?: string;
    };

    export type Note = {
        audio?: NoteMedia[];
        deckName: string;
        fields: Record<string, string>;
        modelName: NoteModel;
        picture?: NoteMedia[];
        tags?: string[];
        video?: NoteMedia[];
    };
}