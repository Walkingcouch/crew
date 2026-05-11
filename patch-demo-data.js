'use strict';
const fs = require('fs');

// ── Helpers ──────────────────────────────────────────────────────────────────
function strReplace(html, oldStr, newStr, label) {
  if (!html.includes(oldStr)) { console.warn('  WARN: anchor not found —', label); return html; }
  return html.replace(oldStr, newStr);
}

// ── 1. Full RC_ITEMS replacement (32 items) ──────────────────────────────────
const OLD_ITEMS_START = '  var RC_ITEMS = [';
const OLD_ITEMS_END   = '\n  ];\n\n  var rcCurCat';

const NEW_ITEMS = `  var RC_ITEMS = [

    /* ── LAWN & GARDEN ─────────────────────────────────────────────────── */
    { id:'r1',  name:'Honda HRX217 Self-Propelled Mower', sub2:'Variable speed · 21" cut · Mulch/Bag/Discharge',
      cat:'lawn', sub:'Mowers', ph:28, pd:45, pw:189, dep:150,
      owner:'Green Thumb Co.', dist:'2.1 km', condLbl:'Excellent', avail:true, delivery:true, rented:47,
      areas:['Katherine NT','Darwin NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'21" Cut'},{i:'⚖️',t:'35 kg'}],
      thumb:{bg:'linear-gradient(135deg,#2d6a4f,#52b788)',em:'🌿',sz:'58px'} },

    { id:'r2',  name:'Husqvarna 525HF3S Hedge Trimmer', sub2:'Petrol · 25" blade · Articulating head',
      cat:'lawn', sub:'Trimmers', ph:20, pd:35, pw:130, dep:90,
      owner:'LawnKing NT', dist:'4.2 km', condLbl:'Good', avail:true, delivery:true, rented:29,
      areas:['Katherine NT','Tennant Creek NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'25" Blade'},{i:'🔄',t:'Articulating'}],
      thumb:{bg:'linear-gradient(135deg,#1b5e20,#43a047)',em:'✂️',sz:'54px'} },

    { id:'r3',  name:'Husqvarna TS 342 Ride-On Mower', sub2:'42" deck · Hydrostatic · 18.5 HP Kawasaki',
      cat:'lawn', sub:'Ride-Ons', ph:55, pd:95, pw:380, dep:300,
      owner:'AliceGreen Pro', dist:'3.8 km', condLbl:'Excellent', avail:false, delivery:true, rented:12,
      areas:['Alice Springs NT','Darwin NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'42" Deck'},{i:'💪',t:'18.5 HP'}],
      thumb:{bg:'linear-gradient(135deg,#4a148c,#7b1fa2)',em:'🚜',sz:'58px'} },

    { id:'r13', name:'Stihl BG 86 Leaf Blower', sub2:'Petrol · 538 m³/hr · Curved tube',
      cat:'lawn', sub:'Blowers', ph:12, pd:22, pw:75, dep:50,
      owner:'LawnKing NT', dist:'4.2 km', condLbl:'Excellent', avail:true, delivery:true, rented:31,
      areas:['Katherine NT','Darwin NT','Alice Springs NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'💨',t:'538 m³/hr'},{i:'⚖️',t:'4.7 kg'}],
      thumb:{bg:'linear-gradient(135deg,#f9a825,#f57f17)',em:'🍃',sz:'54px'} },

    { id:'r14', name:'Briggs & Stratton Lawn Aerator 18"', sub2:'Petrol · Drum-spike · Up to 500m²/hr',
      cat:'lawn', sub:'Aerators', ph:32, pd:55, pw:195, dep:120,
      owner:'Green Thumb Co.', dist:'2.1 km', condLbl:'Good', avail:true, delivery:true, rented:19,
      areas:['Darwin NT','Katherine NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'18" Width'},{i:'🌱',t:'500m²/hr'}],
      thumb:{bg:'linear-gradient(135deg,#33691e,#558b2f)',em:'🌾',sz:'54px'} },

    { id:'r15', name:'McLane 801-5.0-7 Lawn Edger', sub2:'5.0 HP · 7.5" blade · Steel deck',
      cat:'lawn', sub:'Edgers', ph:18, pd:30, pw:105, dep:70,
      owner:'Green Thumb Co.', dist:'2.1 km', condLbl:'Good', avail:true, delivery:true, rented:23,
      areas:['Darwin NT','Katherine NT','Alice Springs NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'7.5" Blade'},{i:'💪',t:'5.0 HP'}],
      thumb:{bg:'linear-gradient(135deg,#827717,#a09323)',em:'📐',sz:'52px'} },

    { id:'r16', name:'Timberwolf TW 14/100 Garden Chipper', sub2:'14 HP · 100mm capacity · Tow hitch',
      cat:'lawn', sub:'Blowers', ph:45, pd:75, pw:280, dep:200,
      owner:'AliceGreen Pro', dist:'3.8 km', condLbl:'Good', avail:true, delivery:true, rented:8,
      areas:['Alice Springs NT','Darwin NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'100mm Cap.'},{i:'💪',t:'14 HP'}],
      thumb:{bg:'linear-gradient(135deg,#4e342e,#6d4c41)',em:'🪵',sz:'54px'} },

    /* ── PRESSURE WASHING ───────────────────────────────────────────────── */
    { id:'r4',  name:'Kärcher K5 Pressure Washer', sub2:'145 bar · 500L/hr · Patio cleaning kit incl.',
      cat:'pressure', sub:'Electric', ph:28, pd:55, pw:220, dep:120,
      owner:'QuickFix Repairs', dist:'5.1 km', condLbl:'Excellent', avail:true, delivery:true, rented:38,
      areas:['Katherine NT','Alice Springs NT','Darwin NT'],
      badges:[{i:'⚡',t:'Electric'},{i:'💧',t:'145 Bar'},{i:'📦',t:'Kit Incl.'}],
      thumb:{bg:'linear-gradient(135deg,#01579b,#0288d1)',em:'💦',sz:'56px'} },

    { id:'r5',  name:'Honda GX390 Petrol Pressure Washer', sub2:'3000 PSI · Honda engine · 15m hose',
      cat:'pressure', sub:'Petrol', ph:38, pd:70, pw:270, dep:180,
      owner:'Desert Clean NT', dist:'6.8 km', condLbl:'Good', avail:true, delivery:true, rented:21,
      areas:['Alice Springs NT','Darwin NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'💧',t:'3000 PSI'},{i:'📏',t:'15m Hose'}],
      thumb:{bg:'linear-gradient(135deg,#0d47a1,#1565c0)',em:'🌊',sz:'54px'} },

    { id:'r17', name:'Kerrick HotShot Hot Water Pressure Washer', sub2:'180°C · 200 bar · Diesel burner · Trailer-mount',
      cat:'pressure', sub:'Hot Water', ph:75, pd:140, pw:560, dep:300,
      owner:'Desert Clean NT', dist:'6.8 km', condLbl:'Excellent', avail:true, delivery:true, rented:14,
      areas:['Alice Springs NT','Darwin NT','Katherine NT'],
      badges:[{i:'🔥',t:'Hot Water'},{i:'💧',t:'200 Bar'},{i:'🚛',t:'Trailer'}],
      thumb:{bg:'linear-gradient(135deg,#b71c1c,#c62828)',em:'♨️',sz:'56px'} },

    { id:'r18', name:'Commercial Drain Jetter 3500 PSI', sub2:'Petrol · 3500 PSI · 60m hose · Nozzle set',
      cat:'pressure', sub:'Commercial', ph:85, pd:160, pw:620, dep:350,
      owner:'NT Pipe & Drain', dist:'9.2 km', condLbl:'Good', avail:false, delivery:true, rented:7,
      areas:['Darwin NT','Katherine NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'💧',t:'3500 PSI'},{i:'📏',t:'60m Hose'}],
      thumb:{bg:'linear-gradient(135deg,#006064,#00838f)',em:'🚿',sz:'54px'} },

    /* ── POWER TOOLS ────────────────────────────────────────────────────── */
    { id:'r6',  name:'Makita 18V 4-Piece Drill Combo Kit', sub2:'2× 5Ah batteries · Rapid charger · Case',
      cat:'tools', sub:'Drills', ph:18, pd:28, pw:98, dep:60,
      owner:'ToolMate NT', dist:'3.4 km', condLbl:'Excellent', avail:true, delivery:true, rented:53,
      areas:['Katherine NT','Alice Springs NT','Darwin NT'],
      badges:[{i:'🔋',t:'18V Li-ion'},{i:'🔩',t:'4-Piece'},{i:'⚖️',t:'3.2 kg'}],
      thumb:{bg:'linear-gradient(135deg,#bf360c,#e64a19)',em:'🔧',sz:'56px'} },

    { id:'r7',  name:'Metabo WE 24-230 Angle Grinder 9"', sub2:'2400W · Paddle switch · Diamond disc incl.',
      cat:'tools', sub:'Grinders', ph:15, pd:25, pw:85, dep:50,
      owner:'ToolMate NT', dist:'3.4 km', condLbl:'Good', avail:true, delivery:true, rented:18,
      areas:['Katherine NT','Tennant Creek NT'],
      badges:[{i:'⚡',t:'2400W'},{i:'📏',t:'9" Disc'},{i:'⚖️',t:'5.1 kg'}],
      thumb:{bg:'linear-gradient(135deg,#37474f,#546e7a)',em:'⚙️',sz:'54px'} },

    { id:'r19', name:'Makita JR3070CT Reciprocating Saw', sub2:'1510W · 32mm stroke · Variable speed',
      cat:'tools', sub:'Saws', ph:14, pd:22, pw:78, dep:45,
      owner:'ToolMate NT', dist:'3.4 km', condLbl:'Excellent', avail:true, delivery:true, rented:27,
      areas:['Katherine NT','Alice Springs NT','Darwin NT'],
      badges:[{i:'⚡',t:'1510W'},{i:'🔄',t:'32mm Stroke'},{i:'⚖️',t:'4.8 kg'}],
      thumb:{bg:'linear-gradient(135deg,#4a148c,#6a1b9a)',em:'🪚',sz:'54px'} },

    { id:'r20', name:'DeWalt DWE576 210mm Circular Saw', sub2:'1600W · 70mm depth · Laser guide',
      cat:'tools', sub:'Saws', ph:14, pd:22, pw:78, dep:45,
      owner:'CenBuild Tools', dist:'7.0 km', condLbl:'Good', avail:true, delivery:true, rented:22,
      areas:['Alice Springs NT','Darwin NT'],
      badges:[{i:'⚡',t:'1600W'},{i:'📏',t:'70mm Depth'},{i:'🔦',t:'Laser Guide'}],
      thumb:{bg:'linear-gradient(135deg,#e65100,#bf360c)',em:'🔩',sz:'54px'} },

    { id:'r21', name:'Puma 50L Air Compressor + Framing Nailer', sub2:'2.5HP · 8 bar · Combo kit',
      cat:'tools', sub:'Compressors', ph:22, pd:38, pw:130, dep:80,
      owner:'CenBuild Tools', dist:'7.0 km', condLbl:'Good', avail:true, delivery:true, rented:16,
      areas:['Alice Springs NT','Darwin NT','Katherine NT'],
      badges:[{i:'💨',t:'50L Tank'},{i:'💪',t:'8 Bar'},{i:'📦',t:'Nailer Incl.'}],
      thumb:{bg:'linear-gradient(135deg,#1a237e,#283593)',em:'🔫',sz:'54px'} },

    { id:'r22', name:'Festool RO 150 FEQ Random Orbital Sander', sub2:'350W · 150mm pad · 5mm orbit · Dust bag',
      cat:'tools', sub:'Sanders', ph:12, pd:20, pw:68, dep:40,
      owner:'ToolMate NT', dist:'3.4 km', condLbl:'Excellent', avail:true, delivery:true, rented:34,
      areas:['Katherine NT','Alice Springs NT','Darwin NT'],
      badges:[{i:'⚡',t:'350W'},{i:'📏',t:'150mm Pad'},{i:'📦',t:'Dust Bag'}],
      thumb:{bg:'linear-gradient(135deg,#00695c,#00897b)',em:'🌀',sz:'52px'} },

    /* ── TRAILERS ───────────────────────────────────────────────────────── */
    { id:'r8',  name:'7×4 ft Cage Box Trailer', sub2:'Removable cage · Jockey wheel · Ball hitch',
      cat:'trailers', sub:'Box Trailer', ph:25, pd:40, pw:160, dep:200,
      owner:'TrailerHire NT', dist:'7.2 km', condLbl:'Good', avail:true, delivery:true, rented:34,
      areas:['Katherine NT','Darwin NT'],
      badges:[{i:'📐',t:'7×4 ft'},{i:'⚖️',t:'750 kg ATM'},{i:'🔒',t:'Lockable'}],
      thumb:{bg:'linear-gradient(135deg,#e65100,#f57c00)',em:'🚛',sz:'58px'} },

    { id:'r23', name:'8×5 ft Hydraulic Tipper Trailer', sub2:'Hydraulic lift · 2000 kg ATM · Mesh sides',
      cat:'trailers', sub:'Tipper', ph:40, pd:65, pw:240, dep:350,
      owner:'TrailerHire NT', dist:'7.2 km', condLbl:'Good', avail:true, delivery:true, rented:19,
      areas:['Katherine NT','Darwin NT','Alice Springs NT'],
      badges:[{i:'📐',t:'8×5 ft'},{i:'⚖️',t:'2000 kg ATM'},{i:'🔼',t:'Hydraulic'}],
      thumb:{bg:'linear-gradient(135deg,#bf360c,#d84315)',em:'⬆️',sz:'56px'} },

    { id:'r24', name:'9×5 ft Car & Boat Trailer', sub2:'Dual axle · Winch · LED lights · Tie-downs ×4',
      cat:'trailers', sub:'Car Trailer', ph:45, pd:75, pw:280, dep:400,
      owner:'NT Tow & Go', dist:'11.3 km', condLbl:'Excellent', avail:true, delivery:true, rented:11,
      areas:['Darwin NT','Alice Springs NT'],
      badges:[{i:'📐',t:'9×5 ft'},{i:'⚙️',t:'Dual Axle'},{i:'🔗',t:'Winch'}],
      thumb:{bg:'linear-gradient(135deg,#263238,#455a64)',em:'🚗',sz:'58px'} },

    { id:'r25', name:'Enclosed Cargo Trailer 8×5 ft', sub2:'Full-height sides · Rear ramp · Lockable',
      cat:'trailers', sub:'Enclosed', ph:38, pd:60, pw:220, dep:300,
      owner:'NT Tow & Go', dist:'11.3 km', condLbl:'Good', avail:false, delivery:true, rented:9,
      areas:['Darwin NT'],
      badges:[{i:'📐',t:'8×5 ft'},{i:'🔒',t:'Lockable'},{i:'♻️',t:'Rear Ramp'}],
      thumb:{bg:'linear-gradient(135deg,#37474f,#546e7a)',em:'📦',sz:'56px'} },

    /* ── CONCRETE & DIGGING ─────────────────────────────────────────────── */
    { id:'r9',  name:'Petrol Cement Mixer 100L Drum', sub2:'4 HP Honda · Steel drum · Folding stand',
      cat:'concrete', sub:'Mixers', ph:35, pd:60, pw:240, dep:150,
      owner:'Centralian Build', dist:'8.5 km', condLbl:'Good', avail:true, delivery:true, rented:16,
      areas:['Alice Springs NT','Tennant Creek NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'🪣',t:'100L Drum'},{i:'💪',t:'4 HP'}],
      thumb:{bg:'linear-gradient(135deg,#4e342e,#6d4c41)',em:'🏗️',sz:'56px'} },

    { id:'r10', name:'Demolition Jackhammer SDS-Max', sub2:'1500W · 45J impact energy · Chisel + point',
      cat:'concrete', sub:'Jackhammers', ph:45, pd:75, pw:280, dep:200,
      owner:'Centralian Build', dist:'8.5 km', condLbl:'Excellent', avail:false, delivery:true, rented:9,
      areas:['Alice Springs NT','Darwin NT'],
      badges:[{i:'⚡',t:'1500W'},{i:'💥',t:'45J Impact'},{i:'⚖️',t:'12 kg'}],
      thumb:{bg:'linear-gradient(135deg,#263238,#37474f)',em:'⛏️',sz:'56px'} },

    { id:'r26', name:'Wacker WP1540 Plate Compactor', sub2:'Petrol · 400mm plate · 14 kN force',
      cat:'concrete', sub:'Compactors', ph:40, pd:68, pw:255, dep:180,
      owner:'Centralian Build', dist:'8.5 km', condLbl:'Good', avail:true, delivery:true, rented:13,
      areas:['Alice Springs NT','Darwin NT','Tennant Creek NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'400mm Plate'},{i:'💪',t:'14 kN'}],
      thumb:{bg:'linear-gradient(135deg,#4e342e,#5d4037)',em:'🪨',sz:'54px'} },

    { id:'r27', name:'Digga 2-Man Post Hole Digger', sub2:'Petrol · 100–300mm augers · Bar-mount',
      cat:'concrete', sub:'Post Hole', ph:48, pd:82, pw:310, dep:220,
      owner:'NT Post & Rail', dist:'13.5 km', condLbl:'Excellent', avail:true, delivery:true, rented:7,
      areas:['Alice Springs NT','Tennant Creek NT','Katherine NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'300mm Auger'},{i:'👥',t:'2-Person'}],
      thumb:{bg:'linear-gradient(135deg,#3e2723,#4e342e)',em:'🕳️',sz:'54px'} },

    { id:'r28', name:'Husqvarna K 770 Concrete Cut-Off Saw', sub2:'Petrol · 14" blade · Wet/dry cutting',
      cat:'concrete', sub:'Jackhammers', ph:50, pd:88, pw:330, dep:250,
      owner:'Centralian Build', dist:'8.5 km', condLbl:'Good', avail:true, delivery:true, rented:11,
      areas:['Alice Springs NT','Darwin NT'],
      badges:[{i:'⛽',t:'Petrol'},{i:'📏',t:'14" Blade'},{i:'💧',t:'Wet/Dry'}],
      thumb:{bg:'linear-gradient(135deg,#212121,#424242)',em:'💈',sz:'54px'} },

    /* ── ACCESS & LIFTING ───────────────────────────────────────────────── */
    { id:'r11', name:'Fibreglass Platform Ladder 3.0m', sub2:'150 kg rated · Non-conductive · AS/NZS cert',
      cat:'access', sub:'Ladders', ph:18, pd:30, pw:95, dep:50,
      owner:'SafeWork NT', dist:'4.9 km', condLbl:'Excellent', avail:true, delivery:true, rented:41,
      areas:['Katherine NT','Alice Springs NT'],
      badges:[{i:'🏗️',t:'3.0m High'},{i:'⚖️',t:'150 kg Rated'},{i:'🛡️',t:'AS/NZS'}],
      thumb:{bg:'linear-gradient(135deg,#006064,#00838f)',em:'🪜',sz:'56px'} },

    { id:'r29', name:'Aluminium Scaffolding Set 2.4m × 4 Bay', sub2:'4 bay · 250 kg/bay · Adjustable base jacks',
      cat:'access', sub:'Scaffolding', ph:55, pd:95, pw:360, dep:250,
      owner:'SafeWork NT', dist:'4.9 km', condLbl:'Good', avail:true, delivery:true, rented:18,
      areas:['Darwin NT','Katherine NT','Alice Springs NT'],
      badges:[{i:'📏',t:'2.4m High'},{i:'⚖️',t:'250 kg/Bay'},{i:'🔩',t:'4 Bay'}],
      thumb:{bg:'linear-gradient(135deg,#607d8b,#78909c)',em:'🏗️',sz:'56px'} },

    { id:'r30', name:'Foldable Engine Hoist 1 Tonne', sub2:'Engine crane · 2-stage boom · 1000 kg cap.',
      cat:'access', sub:'Platform', ph:28, pd:45, pw:165, dep:120,
      owner:'NT Auto & Fab', dist:'6.3 km', condLbl:'Excellent', avail:true, delivery:true, rented:14,
      areas:['Darwin NT','Alice Springs NT'],
      badges:[{i:'⚖️',t:'1000 kg Cap.'},{i:'🔩',t:'Foldable'},{i:'📏',t:'2-Stage Boom'}],
      thumb:{bg:'linear-gradient(135deg,#37474f,#455a64)',em:'🏋️',sz:'54px'} },

    /* ── CLEANING ───────────────────────────────────────────────────────── */
    { id:'r12', name:'Polivac Carpet Extractor Upright', sub2:'45L dual tank · Hose & wand · 1200W',
      cat:'cleaning', sub:'Carpet', ph:35, pd:55, pw:200, dep:100,
      owner:'CleanPro NT', dist:'5.6 km', condLbl:'Good', avail:true, delivery:true, rented:26,
      areas:['Alice Springs NT','Darwin NT','Katherine NT'],
      badges:[{i:'💧',t:'45L Tank'},{i:'⚡',t:'1200W'},{i:'📦',t:'Kit Incl.'}],
      thumb:{bg:'linear-gradient(135deg,#1a237e,#283593)',em:'🧹',sz:'56px'} },

    { id:'r31', name:'Polivac Ambassador Floor Polisher 17"', sub2:'1.5 HP · 175 RPM · Pads & brushes incl.',
      cat:'cleaning', sub:'Floor Polish', ph:25, pd:42, pw:155, dep:80,
      owner:'CleanPro NT', dist:'5.6 km', condLbl:'Excellent', avail:true, delivery:true, rented:33,
      areas:['Darwin NT','Katherine NT','Alice Springs NT'],
      badges:[{i:'⚡',t:'1.5 HP'},{i:'🔄',t:'175 RPM'},{i:'📦',t:'Pads Incl.'}],
      thumb:{bg:'linear-gradient(135deg,#283593,#3949ab)',em:'✨',sz:'54px'} },

    { id:'r32', name:'Pullman PV900 Industrial Wet/Dry Vacuum', sub2:'50L drum · HEPA filter · 3-motor 3600W',
      cat:'cleaning', sub:'Industrial Vac', ph:22, pd:38, pw:135, dep:70,
      owner:'CleanPro NT', dist:'5.6 km', condLbl:'Good', avail:true, delivery:true, rented:20,
      areas:['Darwin NT','Katherine NT','Tennant Creek NT'],
      badges:[{i:'⚡',t:'3600W'},{i:'🪣',t:'50L Drum'},{i:'🛡️',t:'HEPA Filter'}],
      thumb:{bg:'linear-gradient(135deg,#311b92,#4527a0)',em:'🌪️',sz:'54px'} }

  ];\n\n  var rcCurCat`;

// ── 2. My Gear income summary (crew member only) ─────────────────────────────
const OLD_INCOME =
`              <div style="font-size:24px;font-weight:700;color:var(--green);">$347</div>
              <div style="font-size:11px;color:var(--text-3);">6 bookings · 3 items listed</div>`;

const NEW_INCOME =
`              <div style="font-size:24px;font-weight:700;color:var(--green);">$1,284</div>
              <div style="font-size:11px;color:var(--text-3);">22 bookings · 5 items listed</div>`;

// ── 3. My Gear listed items (crew member only) ───────────────────────────────
const OLD_LISTED = `          <!-- Listed items -->
          <div style="overflow-y:auto;flex:1;padding:12px;background:var(--bg);">`;

const NEW_LISTED = `          <!-- Listed items -->
          <div style="overflow-y:auto;flex:1;padding:12px;background:var(--bg);">

            <!-- Gear item 1 — Honda Mower -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#2d6a4f,#52b788);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">🌿</span>
                <span style="position:absolute;top:6px;left:8px;background:#00796b;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">● Available</span>
                <span style="position:absolute;top:6px;right:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:9px;padding:2px 7px;border-radius:6px;">47 rentals</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">Honda HRX217 Mower</div><div style="font-size:11px;color:var(--text-3);">$45/day · 8 bookings this month</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$360</div><div style="font-size:9px;color:var(--text-3);">earned</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="goTo('s-list-gear')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('📋','8 bookings: Mon, Tue, Wed, Thu, Fri, Sat, Sun, Mon')" style="flex:1;background:var(--green);color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Bookings (8)</button>
                </div>
              </div>
            </div>

            <!-- Gear item 2 — Kärcher K5 -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#01579b,#0288d1);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">💦</span>
                <span style="position:absolute;top:6px;left:8px;background:#00796b;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">● Available</span>
                <span style="position:absolute;top:6px;right:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:9px;padding:2px 7px;border-radius:6px;">38 rentals</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">Kärcher K5 Pressure Washer</div><div style="font-size:11px;color:var(--text-3);">$55/day · 5 bookings this month</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$275</div><div style="font-size:9px;color:var(--text-3);">earned</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="goTo('s-list-gear')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('📋','5 bookings this week — Mon, Tue, Wed, Fri, Sat')" style="flex:1;background:var(--green);color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Bookings (5)</button>
                </div>
              </div>
            </div>

            <!-- Gear item 3 — 7×4 Box Trailer -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#e65100,#f57c00);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">🚛</span>
                <span style="position:absolute;top:6px;left:8px;background:#00796b;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">● Available</span>
                <span style="position:absolute;top:6px;right:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:9px;padding:2px 7px;border-radius:6px;">34 rentals</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">7×4 ft Cage Box Trailer</div><div style="font-size:11px;color:var(--text-3);">$40/day · 4 bookings this month</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$160</div><div style="font-size:9px;color:var(--text-3);">earned</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="goTo('s-list-gear')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('📋','4 bookings: Thu–Fri, Sat–Sun, Mon–Tue, Wed')" style="flex:1;background:var(--green);color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Bookings (4)</button>
                </div>
              </div>
            </div>

            <!-- Gear item 4 — Makita Drill Combo -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#bf360c,#e64a19);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">🔧</span>
                <span style="position:absolute;top:6px;left:8px;background:#00796b;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">● Available</span>
                <span style="position:absolute;top:6px;right:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:9px;padding:2px 7px;border-radius:6px;">53 rentals</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">Makita 18V 4-Piece Drill Kit</div><div style="font-size:11px;color:var(--text-3);">$28/day · 3 bookings this month</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$84</div><div style="font-size:9px;color:var(--text-3);">earned</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="goTo('s-list-gear')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('📋','3 bookings — currently out on rental')" style="flex:1;background:var(--green);color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Bookings (3)</button>
                </div>
              </div>
            </div>

            <!-- Gear item 5 — Cement Mixer (unavailable) -->
            <div style="background:var(--surface);border-radius:14px;border:1px solid var(--border);margin-bottom:10px;overflow:hidden;">
              <div style="height:80px;background:linear-gradient(135deg,#4e342e,#6d4c41);display:flex;align-items:center;justify-content:center;position:relative;">
                <span style="font-size:42px;">🏗️</span>
                <span style="position:absolute;top:6px;left:8px;background:#757575;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;">⏸ Maintenance</span>
                <span style="position:absolute;top:6px;right:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:9px;padding:2px 7px;border-radius:6px;">16 rentals</span>
              </div>
              <div style="padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                  <div><div style="font-size:13px;font-weight:700;color:var(--text);">Petrol Cement Mixer 100L</div><div style="font-size:11px;color:var(--text-3);">$60/day · service due</div></div>
                  <div style="text-align:right;"><div style="font-size:15px;font-weight:700;color:var(--green);">$405</div><div style="font-size:9px;color:var(--text-3);">all-time</div></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="showToast('🔧','Mark as available after service is complete')" style="flex:1;background:none;border:1.5px solid var(--border);border-radius:8px;padding:7px;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;">Edit</button>
                  <button onclick="showToast('✅','Mark Available')" style="flex:1;background:#f57f17;color:white;border:none;border-radius:8px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;">Mark Available</button>
                </div>
              </div>
            </div>`;

// ── Process files ─────────────────────────────────────────────────────────────
['Crew_App_Customer_Role.html', 'Crew_App_Crew_Member.html'].forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  const isCrew = file.includes('Crew_Member');

  // Locate and replace old RC_ITEMS block
  const si = html.indexOf(OLD_ITEMS_START);
  const ei = html.indexOf(OLD_ITEMS_END, si);
  if (si === -1 || ei === -1) {
    console.warn(`  WARN [${file}]: RC_ITEMS block boundaries not found`);
  } else {
    html = html.slice(0, si) + NEW_ITEMS + html.slice(ei + OLD_ITEMS_END.length);
    console.log(`  ${file}: ✓ RC_ITEMS expanded (32 items)`);
  }

  // Crew-member-only: income summary + listed items
  if (isCrew) {
    html = strReplace(html, OLD_INCOME,  NEW_INCOME,  'My Gear income summary');
    html = strReplace(html, OLD_LISTED,  NEW_LISTED,  'My Gear listed items start');
    console.log(`  ${file}: ✓ My Gear items updated (5 items)`);
  }

  fs.writeFileSync(file, html, 'utf8');
  console.log(`  ${file}: ✓ saved\n`);
});

console.log('Done.');
