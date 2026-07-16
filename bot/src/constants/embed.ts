import { ColorResolvable } from 'discord.js';
import { isMockApiEnabled } from '../utils/apiConfig';

export const getEmbedColor = (): ColorResolvable => {
    return '#c62932';
};

export const getEmbedFooter = () => {
    return isMockApiEnabled()
        ? '\u26A0 Mock data being used'
        : 'Data retrieved from OpenPowerlifting';
};
