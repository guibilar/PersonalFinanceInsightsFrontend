// Temporary diagnostic for modal-test.html (see there). Plain script: the app's CSP allows no inline scripts.
(function () {
  'use strict';

  const main = document.getElementById('main-content');
  const pageLog = document.getElementById('page-log');
  const lines = [];
  let modalLog = null;
  const start = performance.now();

  function log(text) {
    lines.push(((performance.now() - start) / 1000).toFixed(2).padStart(7) + 's ' + text);
    const out = lines.slice(-80).join('\n');
    pageLog.textContent = out;
    pageLog.scrollTop = pageLog.scrollHeight;
    if (modalLog) {
      modalLog.textContent = out;
      modalLog.scrollTop = modalLog.scrollHeight;
    }
  }

  function describe(el) {
    if (!el || !el.tagName) return String(el);
    let name = el.tagName.toLowerCase();
    if (el.id) name += '#' + el.id;
    else if (typeof el.className === 'string' && el.className)
      name += '.' + el.className.trim().split(/\s+/)[0];
    return name;
  }

  function viewport() {
    const vv = window.visualViewport;
    return (
      'inner ' +
      window.innerWidth +
      'x' +
      window.innerHeight +
      (vv
        ? ' visual ' +
          Math.round(vv.width) +
          'x' +
          Math.round(vv.height) +
          ' offsetTop ' +
          Math.round(vv.offsetTop)
        : '') +
      ' scrollY ' +
      Math.round(window.scrollY)
    );
  }

  // The app's stylesheet (Bootstrap and the app's own styles), found through the app's index.html.
  fetch('/')
    .then((r) => r.text())
    .then((html) => {
      const match = html.match(/href="([^"]*styles[^"]*\.css)"/);
      if (!match) return log('app stylesheet not found');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = match[1];
      document.head.prepend(link);
      log('loaded app stylesheet ' + match[1]);
    })
    .catch((e) => log('could not load app stylesheet: ' + e));

  // Every tap, press, click and focus change on the page, with where it landed.
  function point(e) {
    const t =
      e.touches && e.touches[0]
        ? e.touches[0]
        : e.changedTouches && e.changedTouches[0]
          ? e.changedTouches[0]
          : e;
    return typeof t.clientX === 'number'
      ? { x: Math.round(t.clientX), y: Math.round(t.clientY) }
      : null;
  }
  [
    'touchstart',
    'touchend',
    'pointerdown',
    'mousedown',
    'mouseup',
    'click',
    'focusin',
    'focusout',
    'change',
  ].forEach((type) =>
    document.addEventListener(
      type,
      (e) => {
        if (e.target && e.target.closest && e.target.closest('.log')) return;
        let text = type + ' → ' + describe(e.target);
        const p = point(e);
        if (p && type !== 'focusin' && type !== 'focusout' && type !== 'change') {
          text += ' at ' + p.x + ',' + p.y;
          const hit = document.elementFromPoint(p.x, p.y);
          if (hit !== e.target) text += ' (element there: ' + describe(hit) + ')';
        }
        if (type === 'focusout') text += ' → focus to ' + describe(e.relatedTarget);
        if (e.defaultPrevented) text += ' [prevented]';
        if (type === 'touchstart' || type === 'pointerdown') {
          const select = document.querySelector('.modal-body-area select, dialog select');
          if (select) {
            const r = select.getBoundingClientRect();
            text += ' | dropdown at y ' + Math.round(r.top) + '–' + Math.round(r.bottom);
          }
        }
        log(text);
      },
      true,
    ),
  );
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => log('viewport resized: ' + viewport()));
  }

  function body(id, formSelect) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-body-area';
    wrap.innerHTML =
      '<label class="form-label" for="' +
      id +
      '">Account</label>' +
      '<select id="' +
      id +
      '"' +
      (formSelect ? ' class="form-select"' : '') +
      '>' +
      '<option value="" disabled selected>Select the account</option>' +
      '<option>Chequing · Chequing</option><option>Savings · Savings</option><option>Visa · Credit card</option>' +
      '</select><div class="log"></div>';
    return wrap;
  }

  function header(title, onClose) {
    const head = document.createElement('div');
    head.className = 'modal-header-bar';
    head.innerHTML = '<h2 class="h5 mb-0">' + title + '</h2>';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-outline-secondary btn-sm';
    close.textContent = 'Close';
    close.addEventListener('click', onClose);
    head.append(close);
    return head;
  }

  function openModal(test) {
    const o = test.options;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const layer = document.createElement('div');
    layer.className = 'modal-backdrop-layer' + (o.absolute ? ' layer-absolute' : '');
    if (o.absolute) layer.style.top = window.scrollY + 'px';
    const box = document.createElement('div');
    box.className = 'modal-dialog-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.tabIndex = -1;

    function close() {
      layer.remove();
      modalLog = null;
      document.removeEventListener('keydown', onEscape);
      if (!o.noLock) document.body.style.overflow = previousOverflow;
      if (opener && opener.focus) opener.focus();
      log('closed ' + test.id);
    }
    function onEscape(e) {
      if (e.key === 'Escape') close();
    }

    const content = body('account-' + test.id, o.formSelect);
    box.append(header('Test ' + test.id, close), content);
    layer.append(box);
    main.append(layer);
    modalLog = content.querySelector('.log');

    document.addEventListener('keydown', onEscape);
    if (!o.noLock) document.body.style.overflow = 'hidden';
    let pressed = false;
    layer.addEventListener('mousedown', (e) => {
      pressed = e.target === e.currentTarget;
    });
    layer.addEventListener('click', (e) => {
      if (e.target === e.currentTarget && pressed) close();
      pressed = false;
    });
    requestAnimationFrame(() => box.focus());
    log('opened ' + test.id + ': ' + viewport());
  }

  function openNative(test) {
    const dialog = document.createElement('dialog');
    dialog.className = 'native';
    const content = body('account-' + test.id, true);
    dialog.append(
      header('Test ' + test.id, () => dialog.close()),
      content,
    );
    main.append(dialog);
    modalLog = content.querySelector('.log');
    dialog.addEventListener('close', () => {
      dialog.remove();
      modalLog = null;
      log('closed ' + test.id);
    });
    dialog.showModal();
    log('opened ' + test.id + ': ' + viewport());
  }

  const tests = [
    {
      id: 'A',
      name: 'Modal, plain dropdown',
      note: 'Like the test page that worked, but as a full page.',
      options: {},
    },
    {
      id: 'B',
      name: 'Modal, app-styled dropdown',
      note: 'Exactly like the app’s modal.',
      options: { formSelect: true },
    },
    {
      id: 'C',
      name: 'B without the scroll lock',
      note: 'The page behind can still scroll.',
      options: { formSelect: true, noLock: true },
    },
    {
      id: 'D',
      name: 'B, overlay not fixed to the screen',
      note: 'Placed where the page is scrolled to instead.',
      options: { formSelect: true, absolute: true, noLock: true },
    },
    {
      id: 'N',
      name: 'The browser’s own dialog',
      note: 'A native <dialog>, app-styled dropdown.',
      native: true,
    },
  ];

  const list = document.getElementById('tests');
  tests.forEach((test) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-primary';
    const strong = document.createElement('strong');
    strong.textContent = test.id + ' · ' + test.name;
    const small = document.createElement('small');
    small.className = 'd-block text-body-secondary';
    small.textContent = test.note;
    button.append(strong, small);
    button.addEventListener('click', () => (test.native ? openNative(test) : openModal(test)));
    li.append(button);
    list.append(li);
  });

  log('page ready: ' + viewport());
})();
