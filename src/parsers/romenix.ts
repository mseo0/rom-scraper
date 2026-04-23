import * as cheerio from 'cheerio';
import { GameEntry } from '../types';
import { isNspLink, extractGameName } from '../parser';

export function parseRomenix(html: string): GameEntry[] {
  const $ = cheerio.load(html);
  const entries: GameEntry[] = [];

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (isNspLink(href)) {
      const linkText = $(el).text();
      entries.push({
        index: 0,
        gameName: extractGameName(linkText, href),
        downloadUrl: href,
        sourceName: 'Romenix',
        sourceUrl: 'https://romenix.net/list?system=9&p=1',
      });
    }
  });

  return entries;
}
