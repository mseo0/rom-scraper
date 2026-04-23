import * as cheerio from 'cheerio';
import { GameEntry } from '../types';
import { isNspLink, extractGameName } from '../parser';

export function parseRetrogrados(html: string): GameEntry[] {
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
        sourceName: 'RetrogradosGaming',
        sourceUrl: 'https://www.retrogradosgaming.com',
      });
    }
  });

  return entries;
}
