// Extrai o token da URL (/upload/:token)
const pathSegments = window.location.pathname.split('/').filter(Boolean);
const sessionToken = pathSegments[pathSegments.length - 1];

// Elementos da DOM
const uploadFormContainer = document.getElementById('uploadFormContainer');
const expiredScreen = document.getElementById('expiredScreen');
const successScreen = document.getElementById('successScreen');
const uploadForm = document.getElementById('uploadForm');
const clientNameInput = document.getElementById('clientName');
const workplaceInput = document.getElementById('workplace');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');
const cameraBtn = document.getElementById('cameraBtn');
const galleryBtn = document.getElementById('galleryBtn');
const previewGrid = document.getElementById('previewGrid');
const photoCountBadge = document.getElementById('photoCountBadge');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorAlert = document.getElementById('errorAlert');
const sendMoreBtn = document.getElementById('sendMoreBtn');
const qrCodeImg = document.getElementById('qrCodeImg');

// Estado das fotos selecionadas (limite máximo de 3)
let selectedFiles = [];
const MAX_PHOTOS = 3;

// 1. Validação inicial do Token da Sessão
async function checkSession() {
  if (!sessionToken || sessionToken === 'upload') {
    showExpired();
    return;
  }

  // Carrega o QR Code da sessão
  if (qrCodeImg) {
    qrCodeImg.src = `/api/qrcode/${sessionToken}`;
  }

  try {
    const res = await fetch(`/api/session/${sessionToken}`);
    if (!res.ok) {
      showExpired();
      return;
    }
    const data = await res.json();
    if (!data.valid) {
      showExpired();
    }
  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
    showError('Não foi possível verificar a conexão com o servidor.');
  }
}

function showExpired() {
  uploadFormContainer.classList.add('hidden');
  successScreen.classList.add('hidden');
  expiredScreen.classList.remove('hidden');
}

function showError(message) {
  errorAlert.textContent = message;
  errorAlert.classList.remove('hidden');
}

function clearError() {
  errorAlert.textContent = '';
  errorAlert.classList.add('hidden');
}

// 2. Disparadores de escolha (Câmera ou Galeria)
cameraBtn.addEventListener('click', () => {
  if (selectedFiles.length >= MAX_PHOTOS) {
    showError(`Você já selecionou o limite de ${MAX_PHOTOS} fotos.`);
    return;
  }
  clearError();
  cameraInput.click();
});

galleryBtn.addEventListener('click', () => {
  if (selectedFiles.length >= MAX_PHOTOS) {
    showError(`Você já selecionou o limite de ${MAX_PHOTOS} fotos.`);
    return;
  }
  clearError();
  galleryInput.click();
});

// 3. Captura e processamento de fotos
function handleIncomingFiles(fileList, inputElement) {
  const files = Array.from(fileList);
  if (!files.length) return;

  const remainingSlots = MAX_PHOTOS - selectedFiles.length;
  if (remainingSlots <= 0) {
    showError(`Você já atingiu o limite de ${MAX_PHOTOS} fotos.`);
    return;
  }

  const filesToAdd = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    showError(`Foram adicionadas apenas ${remainingSlots} foto(s) para respeitar o limite de ${MAX_PHOTOS}.`);
  } else {
    clearError();
  }

  filesToAdd.forEach(file => {
    if (file.type.startsWith('image/')) {
      selectedFiles.push(file);
    }
  });

  inputElement.value = '';
  updatePreview();
  validateForm();
}

cameraInput.addEventListener('change', (e) => handleIncomingFiles(e.target.files, cameraInput));
galleryInput.addEventListener('change', (e) => handleIncomingFiles(e.target.files, galleryInput));

// 4. Atualização da Grid de Pré-visualização
function updatePreview() {
  previewGrid.innerHTML = '';
  photoCountBadge.textContent = `${selectedFiles.length} / ${MAX_PHOTOS}`;

  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = `Foto ${index + 1}`;

    const badge = document.createElement('span');
    badge.className = 'preview-number';
    badge.textContent = `#${index + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-photo';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remover foto';
    removeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      URL.revokeObjectURL(img.src);
      selectedFiles.splice(index, 1);
      updatePreview();
      validateForm();
    });

    item.appendChild(img);
    item.appendChild(badge);
    item.appendChild(removeBtn);
    previewGrid.appendChild(item);
  });

  // Desabilita os botões de seleção se já atingiu 3 fotos
  const atLimit = selectedFiles.length >= MAX_PHOTOS;
  cameraBtn.style.opacity = atLimit ? '0.4' : '1';
  galleryBtn.style.opacity = atLimit ? '0.4' : '1';
  cameraBtn.style.pointerEvents = atLimit ? 'none' : 'auto';
  galleryBtn.style.pointerEvents = atLimit ? 'none' : 'auto';
}

// 5. Validação dos campos para liberar botão de envio
function validateForm() {
  const hasName = clientNameInput.value.trim().length > 0;
  const hasWorkplace = workplaceInput.value.trim().length > 0;
  const hasPhotos = selectedFiles.length > 0 && selectedFiles.length <= MAX_PHOTOS;

  submitBtn.disabled = !(hasName && hasWorkplace && hasPhotos);
}

clientNameInput.addEventListener('input', validateForm);
workplaceInput.addEventListener('input', validateForm);

// 6. Submissão do Formulário
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return;

  clearError();
  setLoading(true);

  try {
    const formData = new FormData();
    formData.append('clientName', clientNameInput.value.trim());
    formData.append('workplace', workplaceInput.value.trim());

    selectedFiles.forEach((file) => {
      formData.append('photos', file, file.name);
    });

    const res = await fetch(`/api/upload/${sessionToken}`, {
      method: 'POST',
      body: formData
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || 'Erro ao processar envio das fotos.');
    }

    // Sucesso!
    uploadFormContainer.classList.add('hidden');
    successScreen.classList.remove('hidden');

  } catch (err) {
    console.error('Erro no upload:', err);
    showError(err.message || 'Falha ao enviar fotos. Verifique sua conexão e tente novamente.');
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  if (isLoading) {
    btnText.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
  } else {
    btnText.classList.remove('hidden');
    loadingSpinner.classList.add('hidden');
  }
}

// 7. Botão "Enviar mais fotos" na tela de sucesso
sendMoreBtn.addEventListener('click', () => {
  // Limpa as fotos anteriores, mas mantém nome e local para agilidade
  selectedFiles = [];
  updatePreview();
  validateForm();

  successScreen.classList.add('hidden');
  uploadFormContainer.classList.remove('hidden');
});

// Inicia verificação da sessão
checkSession();
