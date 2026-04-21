import * as migration_20250929_111647 from './20250929_111647';
import * as migration_20260409_141347 from './20260409_141347';
import * as migration_20260421_090448 from './20260421_090448';

export const migrations = [
  {
    up: migration_20250929_111647.up,
    down: migration_20250929_111647.down,
    name: '20250929_111647',
  },
  {
    up: migration_20260409_141347.up,
    down: migration_20260409_141347.down,
    name: '20260409_141347',
  },
  {
    up: migration_20260421_090448.up,
    down: migration_20260421_090448.down,
    name: '20260421_090448'
  },
];
