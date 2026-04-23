import { Source } from './types';

export const TARGET_SOURCES: Source[] = [
  { url: "https://fmhy.net/gamingpiracyguide#nintendo-roms", name: "FMHY", requiresJs: true },
  { url: "https://www.retrogradosgaming.com", name: "RetrogradosGaming", requiresJs: false },
  { url: "https://switchrom.net", name: "SwitchRom", requiresJs: false },
  { url: "https://nswtl.info/", name: "NSWTL", requiresJs: false },
  { url: "https://switch-roms.org", name: "SwitchRomsOrg", requiresJs: false },
  { url: "https://romenix.net/list?system=9&p=1", name: "Romenix", requiresJs: false },
  { url: "https://nspgamehub.com", name: "NspGameHub", requiresJs: false, deepLink: true },
];
