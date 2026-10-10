/*
 * BloopMind - English
 * Copyright (C) 2026 Hasan Berat Kaylan
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * English is the fallback language: every key must exist here.
 */
I18n.register('en', 'English', {
  // Header and stage
  'count.one': '{n} reminder',
  'count.other': '{n} reminders',
  'box.n': 'Box {n}',
  'meter.pct': '{n}% full',
  'meter.full': 'Box full',
  'clearEx': 'Delete examples',
  'clearEx.done': 'Examples deleted',
  'add': 'Add',
  'settings': 'Settings',
  'boxes': 'Boxes',
  'tab.new': '+ New box',
  'empty.title': 'This box is empty',
  'empty.text': 'Tap Add and drop the first bubble in.',
  'hint': 'Tap: details · Hold: pop · Drag: toss',
  'srlist': 'Reminder list',

  // Reminder sheet
  'sheet.new': 'New reminder',
  'sheet.edit': 'Reminder',
  'close': 'Close',
  'cancel': 'Cancel',
  'save': 'Save',
  'pop': 'Pop',
  'addInNewBox': 'Open a new box and add',
  'f.title': 'Title',
  'f.title.ph': 'What should it remind you of?',
  'f.note': 'Note',
  'f.note.ph': 'Add details if you like',
  'f.icon': 'Icon',
  'f.date': 'Date',
  'f.optional': '(optional)',
  'full.notice': 'This box is full. The reminder will drop into a new box.',
  'age.added': 'Added: {d} · {rel}',
  'age.grows': 'It grows as it ages. Its color never changes.',

  // Messages
  'err.title': 'Enter a title.',
  'err.allFull': 'All boxes are full. Pop a bubble to make room.',
  'toast.popped': 'Popped: {t}',
  'toast.undo': 'Undo',
  'toast.boxOpened': 'Box {n} opened',
  'toast.boxFull': 'The box is full. You can open a new one.',

  // Dates
  'time.justNow': 'just now',
  'due.today': 'Today',
  'due.tomorrow': 'Tomorrow',
  'due.left': '{n} days left',
  'due.yesterday': 'Was due yesterday',
  'due.overdue': '{n} days overdue',

  // Settings
  'set.sound': 'Sound',
  'set.sound.label': 'Sound effects',
  'set.sound.desc': 'Bubble collisions, pops and interface sounds.',
  'set.lang': 'Language',
  'set.lang.aria': 'Choose language',
  'set.about': 'About',
  'about.desc': 'Reminders that turn into bubbles. They grow as they age; hold one to pop it.',
  'about.version': 'Version',
  'about.author': 'Author',
  'about.license': 'License',
  'about.source': 'Source code',
  'about.notice': 'Free software, released under the GNU GPL v3. It comes with no warranty.',
  'about.data': 'Your data stays in this browser only.',

  // Example reminders (shown on first launch)
  'ex.note': 'Example reminder. Tap to edit it, or hold to pop it.',
  'ex.0.t': 'Pay the bills', 'ex.0.n': 'Electricity and water, by the end of the month.',
  'ex.1.t': 'Return the book to the library',
  'ex.2.t': 'Call Mom', 'ex.2.n': 'Talk about the weekend.',
  'ex.3.t': 'Doctor appointment',
  'ex.4.t': 'Drink water',
  'ex.5.t': 'Water the plants',
  'ex.6.t': 'Workout',
  'ex.7.t': 'Grocery shopping', 'ex.7.n': 'Milk, bread, eggs.',
  'ex.8.t': 'Birthday gift',

  // Icon names
  'icon.bell': 'Bell', 'icon.calendar': 'Calendar', 'icon.clock': 'Clock', 'icon.check': 'Task',
  'icon.star': 'Star', 'icon.heart': 'Heart', 'icon.cart': 'Shopping', 'icon.phone': 'Phone',
  'icon.mail': 'Email', 'icon.gift': 'Gift', 'icon.cake': 'Birthday', 'icon.pill': 'Medicine',
  'icon.drop': 'Water', 'icon.dumbbell': 'Fitness', 'icon.book': 'Book', 'icon.cap': 'School',
  'icon.bag': 'Work', 'icon.home': 'Home', 'icon.car': 'Car', 'icon.plane': 'Travel',
  'icon.wallet': 'Wallet', 'icon.receipt': 'Bill', 'icon.key': 'Key', 'icon.wrench': 'Repair',
  'icon.music': 'Music', 'icon.camera': 'Photo', 'icon.coffee': 'Coffee', 'icon.food': 'Food',
  'icon.paw': 'Pet', 'icon.leaf': 'Plant', 'icon.sun': 'Sun', 'icon.moon': 'Sleep',
  'icon.bolt': 'Energy', 'icon.flag': 'Flag', 'icon.pin': 'Location', 'icon.users': 'Friends',
  'icon.pulse': 'Health', 'icon.laptop': 'Computer', 'icon.trash': 'Trash'
});
