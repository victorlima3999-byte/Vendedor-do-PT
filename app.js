/* ===================== Rota Comercial — app.js =====================
   Armazenamento local (localStorage) — funciona 100% offline no aparelho.
   Não depende de servidor: cada vendedor tem seus dados no próprio celular.
====================================================================== */

const STORAGE_KEY = 'rota_comercial_produtos_v1';

let produtos = loadProdutos();
let scannerInstance = null;
let scannerTargetInput = null; // quando aberto pelo formulário, preenche esse input
let currentShareProduct = null;

/* ---------------- storage ---------------- */
function loadProdutos(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveProdutos(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
    return true;
  }catch(e){
    toast('Armazenamento cheio — a alteração NÃO foi salva. Exporte um backup e remova fotos antigas.');
    return false;
  }
}
function uid(){ return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7); }

/* ---------------- formatting ---------------- */
function formatBRL(v){
  const n = Number(v)||0;
  return n.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg, undoFn){
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  const undoBtn = document.getElementById('toast-undo-btn');
  if(undoFn){
    undoBtn.style.display = 'inline-flex';
    undoBtn.onclick = ()=>{ undoFn(); el.classList.remove('show'); };
  } else {
    undoBtn.style.display = 'none';
    undoBtn.onclick = null;
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('show'), undoFn ? 4200 : 2200);
}

/* ---------------- helpers compartilhados (evita repetição) ---------------- */
function filterProdutos(query){
  const q = (query || '').toLowerCase().trim();
  if(!q) return produtos;
  return produtos.filter(p => p.nome.toLowerCase().includes(q) || (p.codigo || '').includes(q));
}
function thumbHtml(p){
  return p.foto ? `<img src="${p.foto}" alt="">` : 'sem foto';
}
function priceParts(preco){
  const cents = Math.round((Number(preco) || 0) * 100);
  const reais = Math.floor(Math.abs(cents) / 100).toLocaleString('pt-BR');
  const centavos = String(Math.abs(cents) % 100).padStart(2, '0');
  return { reais, centavos };
}
function priceTagHtml(preco){
  const { reais, centavos } = priceParts(preco);
  return `R$${reais}<span class="cents">,${centavos}</span>`;
}
function normalizeCode(code){
  return String(code || '').replace(/\D/g, '');
}
function findProdutoByCodigo(code){
  const na = normalizeCode(code);
  if(!na) return null;
  return produtos.find(p => normalizeCode(p.codigo) === na);
}

/* ---------------- tabs ---------------- */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    stopScanner();
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if(btn.dataset.view === 'produtos') renderProdutosList();
    if(btn.dataset.view === 'portfolio') renderPortfolio();
    if(btn.dataset.view === 'estoque') renderEstoque();
  });
});

/* ---------------- sheets (modais) ---------------- */
function openSheet(id){
  document.getElementById(id).classList.add('open');
  document.getElementById('backdrop-' + id.replace('sheet-','')).classList.add('open');
}
function closeSheet(id){
  document.getElementById(id).classList.remove('open');
  document.getElementById('backdrop-' + id.replace('sheet-','')).classList.remove('open');
}
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click', ()=> closeSheet(btn.dataset.close));
});
['produto','scanner','share','config'].forEach(name=>{
  document.getElementById('backdrop-' + name).addEventListener('click', ()=>{
    if(name === 'scanner') stopScanner();
    closeSheet('sheet-' + name);
  });
});

/* ===================== PROTEÇÃO: TELA DE ABERTURA + PIN ===================== */
const PIN_KEY = 'rota_comercial_pin_v1';
const DEFAULT_PIN = '1234';
let lockedPortfolio = false; // true = veio da tela de abertura, cliente não pode voltar sem PIN
let pinOnSuccess = null;

function getStoredPin(){
  return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
}
function hideLauncher(){
  document.getElementById('launcher-screen').style.display = 'none';
}

function openPinModal(title, sub, onSuccess){
  document.getElementById('pin-modal-title').textContent = title;
  document.getElementById('pin-modal-sub').textContent = sub;
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').textContent = '';
  pinOnSuccess = onSuccess;
  document.getElementById('pin-backdrop').classList.add('open');
  document.getElementById('pin-modal').classList.add('open');
  setTimeout(()=> document.getElementById('pin-input').focus(), 50);
}
function closePinModal(){
  document.getElementById('pin-backdrop').classList.remove('open');
  document.getElementById('pin-modal').classList.remove('open');
  pinOnSuccess = null;
}
function submitPin(){
  const val = document.getElementById('pin-input').value.trim();
  if(val === getStoredPin()){
    const cb = pinOnSuccess;
    closePinModal();
    if(cb) cb();
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorreto, tente novamente';
    const modal = document.getElementById('pin-modal');
    modal.classList.remove('shake'); void modal.offsetWidth; modal.classList.add('shake');
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
}
document.getElementById('pin-confirm').addEventListener('click', submitPin);
document.getElementById('pin-cancel').addEventListener('click', closePinModal);
document.getElementById('pin-backdrop').addEventListener('click', closePinModal);
document.getElementById('pin-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitPin(); });

/* opções da tela de abertura */
document.getElementById('launcher-btn-portfolio').addEventListener('click', ()=>{
  if(produtos.length === 0){ toast('Cadastre produtos primeiro na área de Controle'); return; }
  hideLauncher();
  lockedPortfolio = true;
  openClientMode(0);
});
document.getElementById('launcher-btn-controle').addEventListener('click', ()=>{
  openPinModal('Digite o PIN', 'Acesso à área do vendedor', ()=>{
    hideLauncher();
    lockedPortfolio = false;
    renderEstoque(); renderProdutosList(); renderPortfolio();
  });
});

/* botão de cadeado no cabeçalho: trava o app no portfólio a qualquer momento */
document.getElementById('btn-lock-header').addEventListener('click', ()=>{
  if(produtos.length === 0){ toast('Cadastre produtos antes de travar em modo cliente'); return; }
  lockedPortfolio = true;
  openClientMode(0);
});

/* engrenagem: abre a tela de configuração */
document.getElementById('btn-config-pin').addEventListener('click', ()=>{
  openSheet('sheet-config');
});

/* alterar PIN (dentro da configuração) */
document.getElementById('btn-alterar-pin').addEventListener('click', ()=>{
  closeSheet('sheet-config');
  openPinModal('PIN atual', 'Digite o PIN atual para alterá-lo', ()=>{
    const novo = window.prompt('Novo PIN (4 números):');
    if(!novo || !/^\d{4}$/.test(novo)){ toast('PIN inválido — use exatamente 4 números'); return; }
    const confirmNovo = window.prompt('Confirme o novo PIN:');
    if(novo !== confirmNovo){ toast('Os PINs não coincidem — nada foi alterado'); return; }
    localStorage.setItem(PIN_KEY, novo);
    toast('PIN atualizado com sucesso');
  });
});

/* ===================== ESTOQUE ===================== */
function renderEstoque(filter){
  const list = document.getElementById('estoque-list');
  const empty = document.getElementById('estoque-empty');
  const q = filter != null ? filter : document.getElementById('estoque-search').value;
  const items = filterProdutos(q);

  list.innerHTML = '';
  empty.style.display = produtos.length === 0 ? 'block' : 'none';

  items.forEach(p=>{
    const low = p.minimo != null && p.estoque <= p.minimo;
    const row = document.createElement('div');
    row.className = 'stock-card';
    row.dataset.id = p.id;
    row.innerHTML = `
      <div class="thumb">${thumbHtml(p)}</div>
      <div class="stock-info">
        <p class="name">${escapeHtml(p.nome)}</p>
        <p class="meta">${p.codigo ? `<span class="barcode mono">${escapeHtml(p.codigo)}</span> · ` : ''}${formatBRL(p.preco)}</p>
      </div>
      <div class="counter">
        <button data-act="dec" data-id="${p.id}">−</button>
        <span class="qty ${low ? 'low':''}">${p.estoque}</span>
        <button data-act="inc" data-id="${p.id}">+</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('button[data-act]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = produtos.find(x=>x.id === btn.dataset.id);
      if(!p) return;
      const antes = p.estoque;
      if(btn.dataset.act === 'inc') p.estoque++;
      else p.estoque = Math.max(0, p.estoque - 1);
      if(!saveProdutos()) p.estoque = antes;
      renderEstoque(q);
    });
  });

  updateTotals();
}
function updateTotals(){
  const totItens = produtos.reduce((s,p)=>s+p.estoque,0);
  const baixo = produtos.filter(p=> p.minimo != null && p.estoque <= p.minimo).length;
  const valor = produtos.reduce((s,p)=> s + (p.estoque * (Number(p.preco)||0)), 0);
  document.getElementById('tot-itens').textContent = totItens;
  document.getElementById('tot-baixo').textContent = baixo;
  document.getElementById('tot-valor').textContent = valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
}
document.getElementById('estoque-search').addEventListener('input', ()=> renderEstoque());

/* ===================== PRODUTOS (cadastro) ===================== */
function renderProdutosList(filter){
  const list = document.getElementById('produtos-list');
  const empty = document.getElementById('produtos-empty');
  const q = filter != null ? filter : document.getElementById('produtos-search').value;
  const items = filterProdutos(q);

  list.innerHTML = '';
  empty.style.display = produtos.length === 0 ? 'block' : 'none';

  items.forEach(p=>{
    const row = document.createElement('div');
    row.className = 'product-row';
    row.innerHTML = `
      <div class="thumb">${thumbHtml(p)}</div>
      <div class="stock-info">
        <p class="name">${escapeHtml(p.nome)}</p>
        <p class="meta">${p.codigo ? `<span class="barcode mono">${escapeHtml(p.codigo)}</span> · ` : ''}Estoque: ${p.estoque}</p>
      </div>
      <div class="price">${formatBRL(p.preco)}</div>
    `;
    row.addEventListener('click', ()=> openEditProduto(p.id));
    list.appendChild(row);
  });
}
document.getElementById('produtos-search').addEventListener('input', ()=> renderProdutosList());

document.getElementById('btn-novo-produto').addEventListener('click', ()=> openNewProduto());

function openNewProduto(){
  document.getElementById('sheet-produto-title').textContent = 'Novo produto';
  document.getElementById('p-id').value = '';
  document.getElementById('p-nome').value = '';
  document.getElementById('p-codigo').value = '';
  document.getElementById('p-preco').value = '';
  document.getElementById('p-estoque').value = '';
  document.getElementById('p-minimo').value = '';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('photo-preview').src = '';
  document.getElementById('photo-picker-label').style.display = 'block';
  document.getElementById('btn-excluir-produto').style.display = 'none';
  openSheet('sheet-produto');
}
function openEditProduto(id){
  const p = produtos.find(x=>x.id === id);
  if(!p) return;
  document.getElementById('sheet-produto-title').textContent = 'Editar produto';
  document.getElementById('p-id').value = p.id;
  document.getElementById('p-nome').value = p.nome;
  document.getElementById('p-codigo').value = p.codigo || '';
  document.getElementById('p-preco').value = p.preco;
  document.getElementById('p-estoque').value = p.estoque;
  document.getElementById('p-minimo').value = p.minimo != null ? p.minimo : '';
  if(p.foto){
    document.getElementById('photo-preview').src = p.foto;
    document.getElementById('photo-preview').style.display = 'block';
    document.getElementById('photo-picker-label').style.display = 'none';
  } else {
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('photo-picker-label').style.display = 'block';
  }
  document.getElementById('btn-excluir-produto').style.display = 'block';
  openSheet('sheet-produto');
}

document.getElementById('photo-picker').addEventListener('click', ()=>{
  document.getElementById('p-photo-input').click();
});
document.getElementById('p-photo-input').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    // reduz tamanho da imagem antes de guardar
    resizeImage(ev.target.result, 640, (dataUrl)=>{
      document.getElementById('photo-preview').src = dataUrl;
      document.getElementById('photo-preview').style.display = 'block';
      document.getElementById('photo-picker-label').style.display = 'none';
      document.getElementById('photo-preview').dataset.value = dataUrl;
    });
  };
  reader.readAsDataURL(file);
});
function resizeImage(dataUrl, maxDim, cb){
  const img = new Image();
  img.onload = ()=>{
    let {width, height} = img;
    if(width > height && width > maxDim){ height = height*(maxDim/width); width = maxDim; }
    else if(height > maxDim){ width = width*(maxDim/height); height = maxDim; }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    cb(canvas.toDataURL('image/jpeg', 0.82));
  };
  img.src = dataUrl;
}

document.getElementById('btn-salvar-produto').addEventListener('click', ()=>{
  const id = document.getElementById('p-id').value;
  const nome = document.getElementById('p-nome').value.trim();
  if(!nome){ toast('Digite o nome do produto'); return; }
  const codigo = document.getElementById('p-codigo').value.trim();
  const preco = parseFloat(document.getElementById('p-preco').value) || 0;
  const estoque = parseInt(document.getElementById('p-estoque').value) || 0;
  const minimoRaw = document.getElementById('p-minimo').value;
  const minimo = minimoRaw === '' ? null : parseInt(minimoRaw);
  const fotoPreview = document.getElementById('photo-preview');
  const foto = fotoPreview.style.display !== 'none' ? (fotoPreview.dataset.value || fotoPreview.src) : null;

  if(codigo){
    const duplicado = findProdutoByCodigo(codigo);
    if(duplicado && duplicado.id !== id){
      if(!confirm(`Esse código já está cadastrado em "${duplicado.nome}". Salvar mesmo assim?`)) return;
    }
  }

  if(id){
    const p = produtos.find(x=>x.id === id);
    const antes = {...p};
    Object.assign(p, {nome, codigo, preco, estoque, minimo, foto: foto || p.foto});
    if(!saveProdutos()){ Object.assign(p, antes); return; }
  } else {
    produtos.push({id: uid(), nome, codigo, preco, estoque, minimo, foto});
    if(!saveProdutos()){ produtos.pop(); return; }
  }
  closeSheet('sheet-produto');
  renderProdutosList();
  renderEstoque();
  toast('Produto salvo');
});

document.getElementById('btn-excluir-produto').addEventListener('click', ()=>{
  const id = document.getElementById('p-id').value;
  if(!id) return;
  if(!confirm('Excluir este produto?')) return;
  const antes = produtos;
  produtos = produtos.filter(p=>p.id !== id);
  if(!saveProdutos()){ produtos = antes; return; }
  closeSheet('sheet-produto');
  renderProdutosList();
  renderEstoque();
  toast('Produto excluído');
});

/* ===================== PORTFÓLIO (cliente) ===================== */
function renderPortfolio(){
  const grid = document.getElementById('portfolio-grid');
  const empty = document.getElementById('portfolio-empty');
  const btnClientMode = document.getElementById('btn-modo-cliente');
  grid.innerHTML = '';
  const hasProdutos = produtos.length > 0;
  empty.style.display = hasProdutos ? 'none' : 'block';
  btnClientMode.style.display = hasProdutos ? 'flex' : 'none';

  produtos.forEach((p, idx)=>{
    const card = document.createElement('div');
    card.className = 'p-card';
    card.innerHTML = `
      <div class="p-img">${thumbHtml(p)}</div>
      <div class="p-body">
        <p class="p-name">${escapeHtml(p.nome)}</p>
        <span class="price-tag">${priceTagHtml(p.preco)}</span>
      </div>
    `;
    card.addEventListener('click', ()=> openShare(p.id));
    grid.appendChild(card);
  });
}

function openShare(id){
  const p = produtos.find(x=>x.id === id);
  if(!p) return;
  currentShareProduct = p;
  document.getElementById('share-img').src = p.foto || '';
  document.getElementById('share-name').textContent = p.nome;
  document.getElementById('share-price').innerHTML = priceTagHtml(p.preco);
  openSheet('sheet-share');
}

function buildShareImage(p, cb){
  const size = 800;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size + 140;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FBF8F1';
  ctx.fillRect(0,0,canvas.width, canvas.height);

  function drawFooterAndFinish(){
    ctx.fillStyle = '#21201C';
    ctx.font = '600 34px "IBM Plex Sans", sans-serif';
    ctx.fillText(p.nome, 28, size + 55, size - 200);
    // price tag
    const priceText = formatBRL(p.preco);
    ctx.fillStyle = '#E8A324';
    const tagW = ctx.measureText(priceText).width + 260;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(28, size + 78, Math.min(tagW,260), 46, 8) : ctx.rect(28, size+78, 200, 46);
    ctx.fill();
    ctx.fillStyle = '#21201C';
    ctx.font = '700 30px "Bebas Neue", sans-serif';
    ctx.fillText(priceText, 44, size + 110);
    cb(canvas.toDataURL('image/jpeg', 0.9));
  }

  if(p.foto){
    const img = new Image();
    img.onload = ()=>{
      // cover-fit into square
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s)/2, sy = (img.height - s)/2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      drawFooterAndFinish();
    };
    img.src = p.foto;
  } else {
    ctx.fillStyle = '#E4DDCB';
    ctx.fillRect(0,0,size,size);
    ctx.fillStyle = '#8a8478';
    ctx.font = '20px sans-serif';
    ctx.fillText('Sem foto', size/2 - 40, size/2);
    drawFooterAndFinish();
  }
}

document.getElementById('btn-share-native').addEventListener('click', ()=>{
  if(!currentShareProduct) return;
  buildShareImage(currentShareProduct, async (dataUrl)=>{
    try{
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${currentShareProduct.nome}.jpg`, {type:'image/jpeg'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title: currentShareProduct.nome,
          text: `${currentShareProduct.nome} — ${formatBRL(currentShareProduct.preco)}`
        });
      } else if(navigator.share){
        await navigator.share({ title: currentShareProduct.nome, text: `${currentShareProduct.nome} — ${formatBRL(currentShareProduct.preco)}` });
      } else {
        downloadDataUrl(dataUrl, currentShareProduct.nome);
        toast('Compartilhamento não suportado — imagem baixada');
      }
    }catch(err){
      if(err.name !== 'AbortError') toast('Não foi possível compartilhar');
    }
  });
});
document.getElementById('btn-share-download').addEventListener('click', ()=>{
  if(!currentShareProduct) return;
  buildShareImage(currentShareProduct, (dataUrl)=> downloadDataUrl(dataUrl, currentShareProduct.nome));
});
function downloadDataUrl(dataUrl, name){
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${name.replace(/\s+/g,'_')}.jpg`;
  a.click();
}

/* ===================== MODO CLIENTE (visualização simples) ===================== */
let clientModeIndex = 0;

function openClientMode(startIndex){
  if(produtos.length === 0) return;
  clientModeIndex = startIndex || 0;
  document.getElementById('client-mode-overlay').classList.add('open');
  renderClientSlide();
}
function closeClientMode(){
  document.getElementById('client-mode-overlay').classList.remove('open');
}
function renderClientSlide(){
  const p = produtos[clientModeIndex];
  if(!p) return;
  const imgWrap = document.getElementById('client-slide-img');
  imgWrap.innerHTML = thumbHtml(p);
  document.getElementById('client-slide-name').textContent = p.nome;
  document.getElementById('client-slide-price').innerHTML = priceTagHtml(p.preco);
  document.getElementById('client-slide-count').textContent = `${clientModeIndex + 1} / ${produtos.length}`;
  document.getElementById('client-prev').disabled = clientModeIndex === 0;
  document.getElementById('client-next').disabled = clientModeIndex === produtos.length - 1;
}
function clientModeStep(delta){
  const next = clientModeIndex + delta;
  if(next < 0 || next >= produtos.length) return;
  clientModeIndex = next;
  renderClientSlide();
}

document.getElementById('btn-modo-cliente').addEventListener('click', ()=> openClientMode(0));
document.getElementById('client-mode-close').addEventListener('click', ()=>{
  if(lockedPortfolio){
    openPinModal('Digite o PIN', 'Voltar para a área do vendedor', ()=>{
      closeClientMode();
      lockedPortfolio = false;
      renderEstoque(); renderProdutosList(); renderPortfolio();
    });
  } else {
    closeClientMode();
  }
});
document.getElementById('client-prev').addEventListener('click', ()=> clientModeStep(-1));
document.getElementById('client-next').addEventListener('click', ()=> clientModeStep(1));

// swipe por toque
(function(){
  const overlay = document.getElementById('client-mode-overlay');
  let startX = 0, startY = 0, tracking = false;
  overlay.addEventListener('touchstart', (e)=>{
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, {passive:true});
  overlay.addEventListener('touchend', (e)=>{
    if(!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){
      clientModeStep(dx < 0 ? 1 : -1);
    }
  }, {passive:true});
})();

/* ===================== SCANNER (câmera) ===================== */
function startScanner(){
  document.getElementById('reader').innerHTML = '';
  scannerInstance = new Html5Qrcode('reader');
  Html5Qrcode.getCameras().then(cams=>{
    if(!cams || !cams.length){ toast('Nenhuma câmera encontrada'); return; }
    const backCam = cams.find(c => /back|rear|traseira/i.test(c.label)) || cams[cams.length-1];
    scannerInstance.start(
      backCam.id,
      { fps: 12, qrbox: { width: 260, height: 160 } },
      (decodedText)=>{
        handleScanResult(decodedText);
      },
      ()=>{ /* erros de leitura contínua — ignorar */ }
    ).catch(()=> toast('Não foi possível acessar a câmera'));
  }).catch(()=> toast('Permissão de câmera negada'));
}
function stopScanner(){
  if(scannerInstance){
    scannerInstance.stop().then(()=> scannerInstance.clear()).catch(()=>{});
    scannerInstance = null;
  }
}
function handleScanResult(code){
  stopScanner();
  closeSheet('sheet-scanner');
  if(scannerTargetInput){
    scannerTargetInput.value = code;
    scannerTargetInput = null;
    toast('Código capturado: ' + code);
    return;
  }
  const existing = findProdutoByCodigo(code);
  if(existing){
    const antes = existing.estoque;
    existing.estoque++;
    const ok = saveProdutos();
    if(!ok) existing.estoque = antes;
    document.querySelector('.tab-btn[data-view="estoque"]').click();
    document.getElementById('estoque-search').value = '';
    renderEstoque('');
    highlightProductCard(existing.id);
    if(ok){
      toast(`${existing.nome}: ${existing.estoque} em estoque (+1)`, ()=>{
        const antesUndo = existing.estoque;
        existing.estoque = Math.max(0, existing.estoque - 1);
        if(!saveProdutos()) existing.estoque = antesUndo;
        renderEstoque('');
      });
    }
  } else {
    openNewProduto();
    document.getElementById('p-codigo').value = code;
    toast('Código não cadastrado — preencha os dados do produto');
  }
}
function highlightProductCard(id){
  requestAnimationFrame(()=>{
    const card = document.querySelector(`.stock-card[data-id="${id}"]`);
    if(!card) return;
    card.scrollIntoView({behavior:'smooth', block:'center'});
    card.classList.add('flash');
    setTimeout(()=> card.classList.remove('flash'), 1300);
  });
}

function openScanner(){
  scannerTargetInput = null;
  openSheet('sheet-scanner');
  startScanner();
}
document.getElementById('btn-scan-header').addEventListener('click', openScanner);
document.getElementById('fab-scan').addEventListener('click', openScanner);
document.getElementById('btn-scan-in-form').addEventListener('click', ()=>{
  scannerTargetInput = document.getElementById('p-codigo');
  openSheet('sheet-scanner');
  startScanner();
});

/* ---------------- utils ---------------- */
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ===================== BACKUP (exportar / importar) ===================== */
function exportarBackup(){
  const payload = { versao: 1, exportadoEm: new Date().toISOString(), produtos };
  const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rota-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  localStorage.setItem('rota_comercial_ultimo_backup', Date.now());
  toast('Backup exportado — guarde o arquivo (ex: envie pra você mesmo no WhatsApp)');
}

function importarBackup(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      // validação em "staging": nada toca os dados atuais até tudo passar
      const data = JSON.parse(reader.result);
      const lista = Array.isArray(data) ? data : data.produtos;
      if(!Array.isArray(lista) || lista.length === 0) throw new Error('formato');
      const validos = lista.filter(p => p && typeof p.nome === 'string' && p.nome.trim());
      if(validos.length === 0) throw new Error('vazio');
      const ids = new Set();
      const staging = validos.map(p => {
        let id = p.id;
        if(!id || ids.has(id)) id = uid();
        ids.add(id);
        return {
          id,
          nome: String(p.nome).trim(),
          codigo: p.codigo ? String(p.codigo) : '',
          preco: Number(p.preco) || 0,
          estoque: parseInt(p.estoque) || 0,
          minimo: p.minimo == null ? null : parseInt(p.minimo),
          foto: (typeof p.foto === 'string' && p.foto.startsWith('data:image')) ? p.foto : null
        };
      });
      const quando = data.exportadoEm ? new Date(data.exportadoEm).toLocaleDateString('pt-BR') : 'data desconhecida';
      if(!confirm(`Este backup tem ${staging.length} produtos (exportado em ${quando}). Substituir os ${produtos.length} atuais?`)) return;
      const antes = produtos;
      produtos = staging;
      if(!saveProdutos()){ produtos = antes; return; }
      renderEstoque(); renderProdutosList(); renderPortfolio();
      closeSheet('sheet-config');
      toast(`Backup restaurado: ${produtos.length} produtos`);
    }catch(e){
      toast('Arquivo de backup inválido — nada foi alterado');
    }
  };
  reader.readAsText(file);
}

document.getElementById('btn-exportar-backup').addEventListener('click', exportarBackup);
document.getElementById('btn-importar-backup').addEventListener('click', ()=>{
  document.getElementById('backup-file-input').click();
});
document.getElementById('backup-file-input').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(file) importarBackup(file);
  e.target.value = '';
});

/* ---------------- init ---------------- */
renderEstoque();
renderProdutosList();

/* pede ao navegador para não apagar os dados em limpezas automáticas (melhor esforço, não é garantia) */
if(navigator.storage && navigator.storage.persist) navigator.storage.persist();

/* ---------------- service worker (PWA offline + instalação) ---------------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
