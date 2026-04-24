import { Source } from './types';

export const TARGET_SOURCES: Source[] = [
  // Single-pass sources
  { url: "https://fmhy.net/gamingpiracyguide#nintendo-roms", name: "FMHY", requiresJs: true },
  { url: "https://www.retrogradosgaming.com", name: "RetrogradosGaming", requiresJs: false },
  { url: "https://nswtl.info/", name: "NSWTL", requiresJs: false },
  { url: "https://romenix.net/list?system=9&p=1", name: "Romenix", requiresJs: false },

  // Multi-layer sources
  { url: "https://not.ultranx.ru/en", name: "notUltraNX", requiresJs: false },
  { url: "https://nxbrew.net/", name: "NXBrew", requiresJs: false },
  { url: "https://switchgamesmall.icu/", name: "SwitchGamesMall", requiresJs: false },
  { url: "https://www.ziperto.com/nintendo-switch-nsp/", name: "Ziperto", requiresJs: true },
];
