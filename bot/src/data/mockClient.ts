import { matchSorter } from 'match-sorter';
import { Lifter, Meet, MeetChoice, TopLifter } from '../types/types';
import { AmbiguousMeetError } from './apiClient';
import { lifterData } from './mock/lifter';
import { meetData } from './mock/meet';
import { topLifterData } from './mock/top';

export async function getLifter(name: string): Promise<Lifter | undefined> {
    const lifterNames = lifterData.map((l) => l.name);
    const sortedNames = matchSorter(lifterNames, name);
    if (sortedNames.length === 0) return undefined;
    const closestName = sortedNames[0];
    return lifterData.find((l) => l.name === closestName);
}

function meetPath(meet: (typeof meetData)[number]): string {
    return new URL(meet.url).pathname.slice('/m/'.length);
}

function legacyMeetName(meet: Meet): string {
    return `${meet.year} ${meet.federation} ${meet.name}`;
}

function meetLabel(meet: (typeof meetData)[number]): string {
    return `${meet.date} [${meetPath(meet)}] ${meet.federation} ${meet.name}`;
}

export async function getMeet(name: string): Promise<Meet | undefined> {
    const exact = meetData.find((meet) => meetPath(meet) === name.trim());
    if (exact) return exact;
    const matches = meetData.filter(
        (meet) =>
            legacyMeetName(meet).toLowerCase() === name.toLowerCase().trim(),
    );
    if (matches.length > 1) {
        throw new AmbiguousMeetError(
            'Multiple meets match. Select a meet from autocomplete.',
        );
    }
    return matches[0];
}

export async function getTopLifters(
    page: number = 1,
): Promise<TopLifter[] | undefined> {
    const limit = 5;
    const offset = (page - 1) * limit;
    return topLifterData.slice(offset, offset + limit);
}

export async function getLifterAutocomplete(
    query: string,
    limit: number = 10,
): Promise<string[] | undefined> {
    const lifterNames = lifterData.map((l) => l.name);
    const sortedNames = matchSorter(lifterNames, query);
    return sortedNames.slice(0, limit);
}

export async function getMeetAutocomplete(
    query: string,
    limit: number = 10,
): Promise<MeetChoice[] | undefined> {
    return matchSorter(meetData, query, {
        keys: [meetLabel, legacyMeetName],
    })
        .slice(0, limit)
        .map((meet) => ({
            name: meetLabel(meet),
            value: meetPath(meet),
        }));
}
