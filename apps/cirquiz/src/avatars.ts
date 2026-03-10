import { SvgProps } from 'react-native-svg';
import React from 'react';

import { colors } from './theme';

import ChiliSvg from '../assets/avatars/chili.svg';
import WhaleSvg from '../assets/avatars/whale.svg';
import AlienSvg from '../assets/avatars/alien.svg';
import JackolanternSvg from '../assets/avatars/jackolantern.svg';
import GremlinSvg from '../assets/avatars/gremlin.svg';
import RobotSvg from '../assets/avatars/robot.svg';
import BrainSvg from '../assets/avatars/brain.svg';
import RubberduckSvg from '../assets/avatars/rubberduck.svg';
import HotsauceSvg from '../assets/avatars/hotsauce.svg';
import YetiSvg from '../assets/avatars/yeti.svg';

export type AvatarKey =
  | 'chili'
  | 'whale'
  | 'alien'
  | 'jackolantern'
  | 'gremlin'
  | 'robot'
  | 'brain'
  | 'rubberduck'
  | 'hotsauce'
  | 'yeti';

export interface AvatarDef {
  key: AvatarKey;
  color: string;
  Component: React.FC<SvgProps>;
}

export const AVATAR_LIST: AvatarDef[] = [
  { key: 'chili', color: colors.playerPalette.red, Component: ChiliSvg },
  { key: 'whale', color: colors.playerPalette.blue, Component: WhaleSvg },
  { key: 'alien', color: colors.playerPalette.green, Component: AlienSvg },
  { key: 'jackolantern', color: colors.playerPalette.orange, Component: JackolanternSvg },
  { key: 'gremlin', color: colors.playerPalette.purple, Component: GremlinSvg },
  { key: 'robot', color: colors.playerPalette.teal, Component: RobotSvg },
  { key: 'brain', color: colors.playerPalette.pink, Component: BrainSvg },
  { key: 'rubberduck', color: colors.playerPalette.yellow, Component: RubberduckSvg },
  { key: 'hotsauce', color: colors.playerPalette.coral, Component: HotsauceSvg },
  { key: 'yeti', color: colors.playerPalette.cyan, Component: YetiSvg },
];

export const AVATAR_MAP: Record<AvatarKey, AvatarDef> = Object.fromEntries(
  AVATAR_LIST.map((a) => [a.key, a])
) as Record<AvatarKey, AvatarDef>;

export function getAvatar(key: string): AvatarDef {
  return AVATAR_MAP[key as AvatarKey] ?? AVATAR_LIST[0];
}
