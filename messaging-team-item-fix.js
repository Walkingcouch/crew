// ═══════════════════════════════════════════════════════════════════════════
// COMMAND CENTER - MESSAGING FIX - OVERRIDE .team-item FLEX FOR CHANNELS
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const style = document.createElement('style');
  style.id = 'team-item-override-fix';
  style.textContent = `
    /*
      ROOT CAUSE: .team-item has "display: flex; align-items: center" in the
      main stylesheet, which lays channel cards out horizontally side-by-side.

      The sidebar is a <div class="sidebar"> containing multiple
      <div class="sidebar-section"> blocks. The Channels section is the one
      whose header text is "Channels". We force every .team-item inside any
      sidebar-section to stack vertically as a full-width block.
    */

    /* Every team-item in the sidebar stacks vertically */
    .sidebar .sidebar-section .team-item {
      display: flex !important;
      flex-direction: row !important;   /* keep icon + label in a row */
      align-items: center !important;
      width: 100% !important;
      box-sizing: border-box !important;
      margin-bottom: 2px !important;
    }

    /*
      The actual problem: when NEW channels are dynamically injected via
      createChannel() they get inserted as siblings and inherit flex from
      the parent sidebar-section which may itself be a flex container.
      Force the sidebar-section that holds channels to be a block column.
    */
    .sidebar .sidebar-section {
      display: block !important;
      width: 100% !important;
    }

    /* Each team-item should never shrink or grow unexpectedly */
    .sidebar .sidebar-section .team-item {
      flex-shrink: 0 !important;
      flex-grow: 0 !important;
      min-width: 0 !important;
    }

    /* Team name text should truncate gracefully, not overflow */
    .sidebar .sidebar-section .team-item .team-name {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      flex: 1 !important;
      min-width: 0 !important;
    }
  `;

  // Inject as early as possible so it applies before first paint
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(style);
    });
  }

  console.log('🎯 Channel team-item layout fix applied');

})();
