// Documentation on data used
// https://gitlab.com/openpowerlifting/opl-data/blob/main/docs/data-readme.md

// Largely based on
// https://gitlab.com/openpowerlifting/opl-data/blob/main/scripts/compile-sqlite

export interface Lifter {
    name: string;
    url: string;
    meets: {
        place: number;
        federation: string;
        date: string;
        country: string;
        state: string | null;
        name: string;
        division: string | null;
        age: number | null;
        equipment: string;
        weightClass: number | null;
        bodyWeight: number | null;
        squat: number | null;
        bench: number | null;
        deadlift: number | null;
        total: number | null;
        dots: number | null;
    }[];
    personalBests:
        | {
              equipment: string;
              squat: string | null;
              bench: string | null;
              deadlift: string | null;
              total: string;
              dots: string;
          }[]
        | null;
}

export interface Meet {
    name: string;
    federation: string;
    date: string;
    year: string;
    url: string | null;
    country: string;
    state: string | null;
    town: string | null;
    entries: {
        place: number;
        name: string;
        sex: string;
        age: number | null;
        equipment: string;
        weightClass: number | null;
        bodyWeight: number | null;
        squat: number | null;
        bench: number | null;
        deadlift: number | null;
        total: number | null;
        dots: number | null;
    }[];
}

export interface TopLifter {
    name: string;
    sex: string;
    url: string;
    squat: number | null;
    bench: number | null;
    deadlift: number | null;
    total: number | null;
    dots: number;
}
