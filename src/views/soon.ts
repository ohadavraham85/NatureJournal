/* views/soon.ts — placeholder for tabs planned for the next stage (map, gallery). */

import { icon, type IconName } from '../lib/icons';
import type { View } from './view';

export function soonView(iconName: IconName, title: string, text: string): View {
  return {
    init(el) {
      el.innerHTML = `<div class="empty soon">${icon(iconName, 52, 1.4)}<h2>${title}</h2><p class="muted">${text}</p></div>`;
    },
    activate() {},
  };
}
