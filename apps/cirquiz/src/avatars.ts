import { SvgProps } from 'react-native-svg';
import React from 'react';

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
  { key: 'chili', color: '#E74C3C', Component: ChiliSvg },
  { key: 'whale', color: '#3498DB', Component: WhaleSvg },
  { key: 'alien', color: '#2ECC71', Component: AlienSvg },
  { key: 'jackolantern', color: '#F39C12', Component: JackolanternSvg },
  { key: 'gremlin', color: '#9B59B6', Component: GremlinSvg },
  { key: 'robot', color: '#1ABC9C', Component: RobotSvg },
  { key: 'brain', color: '#E91E63', Component: BrainSvg },
  { key: 'rubberduck', color: '#F1C40F', Component: RubberduckSvg },
  { key: 'hotsauce', color: '#FF5722', Component: HotsauceSvg },
  { key: 'yeti', color: '#00BCD4', Component: YetiSvg },
];

export const AVATAR_MAP: Record<AvatarKey, AvatarDef> = Object.fromEntries(
  AVATAR_LIST.map((a) => [a.key, a])
) as Record<AvatarKey, AvatarDef>;

export function getAvatar(key: string): AvatarDef {
  return AVATAR_MAP[key as AvatarKey] ?? AVATAR_LIST[0];
}
