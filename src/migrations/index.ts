import * as migration_20250929_111647 from './20250929_111647';
import * as migration_20260409_141347 from './20260409_141347';
import * as migration_20260421_090448 from './20260421_090448';
import * as migration_20260526_100935_whitepapers_and_documents from './20260526_100935_whitepapers_and_documents';
import * as migration_20260707_114205_import_export_plugin from './20260707_114205_import_export_plugin';

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
    name: '20260421_090448',
  },
  {
    up: migration_20260526_100935_whitepapers_and_documents.up,
    down: migration_20260526_100935_whitepapers_and_documents.down,
    name: '20260526_100935_whitepapers_and_documents',
  },
  {
    up: migration_20260707_114205_import_export_plugin.up,
    down: migration_20260707_114205_import_export_plugin.down,
    name: '20260707_114205_import_export_plugin'
  },
];
