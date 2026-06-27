/* ===================================================
   🧠 옵시디언 스타일 마인드맵 - 메인 엔진
   
   비유: 이 파일은 마인드맵의 "두뇌"예요!
   - 데이터 관리 (어떤 노드가 있는지, 누가 누구의 자식인지)
   - 캔버스 렌더링 (노드와 선을 그리기)
   - 이벤트 처리 (클릭, 드래그, 줌)
   - 사이드바 UI 연동
   
   수학으로 비유하면:
   - 노드 = 좌표평면 위의 점
   - 연결선 = 두 점을 잇는 곡선(베지에 곡선)
   - 드래그 = 점의 좌표(x, y) 변경
   - 줌 = 좌표계 전체의 배율(scale) 조절
   =================================================== */

/* ---- 앱 전체가 로드되면 시작! ---- */
document.addEventListener('DOMContentLoaded', () => {

  // ==============================================
  // 1단계: 캔버스 설정 (도화지 준비)
  // ==============================================
  const canvas = document.getElementById('mindmap-canvas');
  const ctx = canvas.getContext('2d');
  
  /* 캔버스 크기를 부모 요소에 맞추기 (레티나 디스플레이 대응)
     비유: 도화지를 액자 크기에 맞게 자르는 작업! */
  function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrapper.clientWidth * dpr;
    canvas.height = wrapper.clientHeight * dpr;
    canvas.style.width = wrapper.clientWidth + 'px';
    canvas.style.height = wrapper.clientHeight + 'px';
    ctx.scale(dpr, dpr);
    render();
  }

  window.addEventListener('resize', resizeCanvas);

  // ==============================================
  // 2단계: 카메라(뷰포트) 상태
  // 비유: 좌표평면을 보는 "카메라"의 위치와 줌 레벨
  // ==============================================
  const camera = {
    x: 0,      // 카메라가 보고 있는 x 좌표
    y: 0,      // 카메라가 보고 있는 y 좌표
    zoom: 1,   // 줌 배율 (1 = 100%)
  };

  // ==============================================
  // 3단계: 마인드맵 데이터 구조
  // 비유: 족보(트리)처럼 부모-자식 관계!
  // ==============================================
  let nodeIdCounter = 0;   // 노드마다 고유 번호 부여
  let nodes = [];          // 모든 노드 배열
  let selectedNodeId = null; // 현재 선택된 노드 ID

  /* 노드 하나를 만드는 함수 (공장처럼 찍어내기) */
  function createNode(text, parentId, color, x, y) {
    const id = ++nodeIdCounter;
    const node = {
      id: id,
      text: text,
      parentId: parentId,  // null이면 루트 노드
      color: color || '#a855f7',
      x: x,
      y: y,
      /* 노드 크기는 텍스트 길이에 따라 동적 계산 */
      width: 0,
      height: 40,
    };
    nodes.push(node);
    return node;
  }

  /* 특정 노드의 자식 노드들 찾기 */
  function getChildren(parentId) {
    return nodes.filter(n => n.parentId === parentId);
  }

  /* 특정 노드 찾기 */
  function findNode(id) {
    return nodes.find(n => n.id === id);
  }

  /* 노드와 그 모든 자손 삭제 (재귀!)
     비유: 가계도에서 한 줄기를 통째로 자르는 것 */
  function deleteNodeAndChildren(id) {
    const children = getChildren(id);
    children.forEach(child => deleteNodeAndChildren(child.id));
    nodes = nodes.filter(n => n.id !== id);
  }

  // ==============================================
  // 4단계: 노드 배치 알고리즘
  // 비유: 학생들을 운동장에 줄 세우는 것!
  // 새 노드가 추가되면 부모 근처에 적절히 배치
  // ==============================================
  function autoPlaceNode(parentId) {
    if (parentId === null) {
      // 루트 노드는 캔버스 중앙에 배치
      const wrapper = document.getElementById('canvas-wrapper');
      return {
        x: wrapper.clientWidth / 2,
        y: wrapper.clientHeight / 2,
      };
    }

    const parent = findNode(parentId);
    if (!parent) return { x: 400, y: 300 };

    /* 이미 있는 자식 수 = 새 노드의 인덱스
       비유: 반에 학생이 3명 있으면 새 학생은 4번째(index=3) */
    const existingSiblings = getChildren(parentId);
    const newIndex = existingSiblings.length; // 0부터 시작하는 인덱스
    const totalAfter = newIndex + 1;          // 추가 후 전체 자식 수
    
    /* 자식 노드를 부모 아래쪽에 부채꼴로 배치
       수학적으로: 각도 = startAngle + index * (angleSpread / (total - 1))
       반지름 = 기본값 + 자식 수가 많으면 조금씩 증가 */
    const baseRadius = 180;
    const radius = baseRadius + Math.max(0, totalAfter - 3) * 25;
    
    // 부채꼴 각도 계산 (아래쪽 중심으로 좌우 펼치기)
    const angleSpread = Math.min(Math.PI * 1.5, Math.PI * 0.4 * totalAfter); // 최대 270도
    const startAngle = Math.PI / 2 - angleSpread / 2; // 아래쪽(90도) 기준 좌우 대칭

    let angle;
    if (totalAfter === 1) {
      // 자식이 1개뿐이면 → 바로 아래
      angle = Math.PI / 2;
    } else {
      // 여러 자식이면 → 균등하게 분배 (등차수열처럼!)
      angle = startAngle + newIndex * (angleSpread / (totalAfter - 1));
    }

    return {
      x: parent.x + Math.cos(angle) * radius,
      y: parent.y + Math.sin(angle) * radius,
    };
  }

  // ==============================================
  // 5단계: 캔버스 렌더링 (그림 그리기!)
  // 매 프레임마다 캔버스를 지우고 다시 그려요
  // ==============================================
  function render() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    // 캔버스 깨끗이 지우기 (칠판 지우는 것)
    ctx.clearRect(0, 0, w, h);

    // 카메라 변환 적용 (줌 + 이동)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 1) 연결선 먼저 그리기 (노드 뒤에 깔리도록)
    drawConnections();

    // 2) 노드 그리기
    drawNodes();

    ctx.restore();
  }

  /* ---- 연결선 그리기 (베지에 곡선) ---- */
  function drawConnections() {
    nodes.forEach(node => {
      if (node.parentId === null) return;
      const parent = findNode(node.parentId);
      if (!parent) return;

      ctx.save();

      // 곡선 스타일 설정
      ctx.strokeStyle = hexToRgba(node.color, 0.3);
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      // 베지에 곡선으로 부드러운 연결선!
      // 비유: 두 점 사이를 직선이 아닌 부드러운 S커브로 잇기
      const dx = node.x - parent.x;
      const dy = node.y - parent.y;
      const controlOffset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.5 + 40;

      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);
      ctx.bezierCurveTo(
        parent.x + dx * 0.3, parent.y + controlOffset * Math.sign(dy || 1),
        node.x - dx * 0.3, node.y - controlOffset * Math.sign(dy || 1),
        node.x, node.y
      );
      ctx.stroke();

      // 연결선 위에 미세한 글로우 효과
      ctx.strokeStyle = hexToRgba(node.color, 0.08);
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.restore();
    });
  }

  /* ---- 노드 그리기 ---- */
  function drawNodes() {
    nodes.forEach(node => {
      const isSelected = (node.id === selectedNodeId);
      
      // 노드 크기 계산 (텍스트 길이에 맞춤)
      ctx.font = '600 14px "Wanted Sans Variable", sans-serif';
      const textMetrics = ctx.measureText(node.text);
      node.width = Math.max(textMetrics.width + 36, 80);
      node.height = 40;

      const x = node.x - node.width / 2;
      const y = node.y - node.height / 2;

      ctx.save();

      // 선택된 노드: 바깥 글로우 효과!
      if (isSelected) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // 노드 배경 (둥근 사각형)
      ctx.fillStyle = hexToRgba(node.color, 0.12);
      roundRect(ctx, x, y, node.width, node.height, 12);
      ctx.fill();

      // 그림자 리셋 (테두리에는 그림자 안 넣기)
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 노드 테두리
      ctx.strokeStyle = hexToRgba(node.color, isSelected ? 0.9 : 0.4);
      ctx.lineWidth = isSelected ? 2 : 1.5;
      roundRect(ctx, x, y, node.width, node.height, 12);
      ctx.stroke();

      // 노드 텍스트
      ctx.fillStyle = isSelected ? '#ffffff' : '#e6edf3';
      ctx.font = '600 14px "Wanted Sans Variable", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.text, node.x, node.y);

      ctx.restore();
    });
  }

  /* ---- 둥근 사각형 경로 헬퍼 ---- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ---- HEX 색상 → RGBA 변환 헬퍼 ---- */
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ==============================================
  // 6단계: 마우스 이벤트 처리
  // 비유: 게임 컨트롤러 같은 역할!
  // ==============================================
  let isDragging = false;     // 노드를 드래그 중인지
  let isPanning = false;      // 캔버스를 이동 중인지
  let dragNodeId = null;      // 드래그 중인 노드 ID
  let dragStartX = 0;
  let dragStartY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;

  /* 화면 좌표 → 월드 좌표 변환
     비유: 디스플레이 픽셀 위치를 "진짜 수학 좌표"로 바꾸는 것 */
  function screenToWorld(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
      x: (screenX - rect.left - cx) / camera.zoom + camera.x,
      y: (screenY - rect.top - cy) / camera.zoom + camera.y,
    };
  }

  /* 마우스 위치에 있는 노드 찾기 (충돌 감지)
     비유: "이 점이 사각형 안에 있나?" 판정 */
  function hitTest(worldX, worldY) {
    // 뒤에서부터 검사 (위에 그려진 노드가 우선)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const halfW = node.width / 2;
      const halfH = node.height / 2;
      if (worldX >= node.x - halfW && worldX <= node.x + halfW &&
          worldY >= node.y - halfH && worldY <= node.y + halfH) {
        return node;
      }
    }
    return null;
  }

  /* ---- 마우스 클릭 시작 (mousedown) ---- */
  canvas.addEventListener('mousedown', (e) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const hitNode = hitTest(world.x, world.y);

    if (hitNode) {
      // 노드를 클릭했으면 → 선택 + 드래그 준비
      selectedNodeId = hitNode.id;
      isDragging = true;
      dragNodeId = hitNode.id;
      dragStartX = world.x - hitNode.x;
      dragStartY = world.y - hitNode.y;
      canvas.style.cursor = 'grabbing';
    } else {
      // 빈 공간 클릭 → 선택 해제 + 패닝 준비
      selectedNodeId = null;
      isPanning = true;
      canvas.style.cursor = 'grabbing';
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    updateSidebar();
    render();
  });

  /* ---- 마우스 이동 (mousemove) ---- */
  canvas.addEventListener('mousemove', (e) => {
    if (isDragging && dragNodeId !== null) {
      // 노드 드래그: 노드의 좌표를 마우스 위치로 갱신
      const world = screenToWorld(e.clientX, e.clientY);
      const node = findNode(dragNodeId);
      if (node) {
        node.x = world.x - dragStartX;
        node.y = world.y - dragStartY;
        render();
      }
    } else if (isPanning) {
      // 캔버스 패닝: 카메라 위치 이동
      const dx = (e.clientX - lastMouseX) / camera.zoom;
      const dy = (e.clientY - lastMouseY) / camera.zoom;
      camera.x -= dx;
      camera.y -= dy;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      render();
    } else {
      // 호버 효과: 노드 위에 있으면 커서 변경
      const world = screenToWorld(e.clientX, e.clientY);
      const hitNode = hitTest(world.x, world.y);
      canvas.style.cursor = hitNode ? 'pointer' : 'grab';
    }
  });

  /* ---- 마우스 버튼 놓기 (mouseup) ---- */
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    isPanning = false;
    dragNodeId = null;
    canvas.style.cursor = 'grab';
  });

  /* 마우스가 캔버스 바깥으로 나가도 드래그 해제 */
  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    isPanning = false;
    dragNodeId = null;
  });

  /* ---- 마우스 휠: 줌 인/아웃 ---- */
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    if (e.deltaY < 0) {
      // 휠 올리면 확대
      camera.zoom = Math.min(camera.zoom * (1 + zoomFactor), 3);
    } else {
      // 휠 내리면 축소
      camera.zoom = Math.max(camera.zoom * (1 - zoomFactor), 0.2);
    }
    render();
  }, { passive: false });

  /* ---- 더블클릭: 노드 이름 인라인 편집 ---- */
  canvas.addEventListener('dblclick', (e) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const hitNode = hitTest(world.x, world.y);
    if (!hitNode) return;

    const newName = prompt('노드 이름 수정:', hitNode.text);
    if (newName && newName.trim()) {
      hitNode.text = newName.trim();
      updateSidebar();
      render();
    }
  });

  // ==============================================
  // 7단계: 사이드바 UI 연동
  // 비유: 리모컨(사이드바)으로 TV(캔버스)를 조종!
  // ==============================================

  /* ---- 사이드바 전체 업데이트 ---- */
  function updateSidebar() {
    updateNodeTree();
    updateParentSelect();
    updateEditPanel();
  }

  /* ---- 노드 트리 목록 갱신 ---- */
  function updateNodeTree() {
    const treeList = document.getElementById('node-tree-list');
    const emptyState = document.getElementById('empty-state');
    
    treeList.innerHTML = '';

    if (nodes.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    // 루트 노드부터 재귀적으로 트리 구성
    const rootNodes = nodes.filter(n => n.parentId === null);
    rootNodes.forEach(rootNode => {
      renderTreeNode(rootNode, treeList, 0);
    });
  }

  /* 트리 노드 하나를 HTML로 만들어서 추가 (재귀) */
  function renderTreeNode(node, parentEl, depth) {
    const li = document.createElement('li');
    li.className = 'node-tree-item' + (node.id === selectedNodeId ? ' active' : '');
    li.setAttribute('data-depth', depth);
    li.setAttribute('data-node-id', node.id);
    li.style.animationDelay = `${depth * 0.05}s`;

    li.innerHTML = `
      <span class="node-color-dot" style="background: ${node.color};"></span>
      <span class="material-symbols-rounded">${depth === 0 ? 'star' : 'circle'}</span>
      <span class="node-name">${node.text}</span>
    `;

    // 클릭하면 해당 노드 선택
    li.addEventListener('click', () => {
      selectedNodeId = node.id;
      // 카메라를 해당 노드로 이동 (부드럽게)
      animateCameraTo(node.x, node.y);
      updateSidebar();
      render();
    });

    parentEl.appendChild(li);

    // 자식 노드들도 재귀적으로 추가
    const children = getChildren(node.id);
    children.forEach(child => renderTreeNode(child, parentEl, depth + 1));
  }

  /* ---- 부모 노드 선택 드롭다운 갱신 ---- */
  function updateParentSelect() {
    const select = document.getElementById('select-parent-node');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="root">루트 (최상위)</option>';
    
    nodes.forEach(node => {
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = node.text;
      select.appendChild(option);
    });

    // 이전 선택값 유지
    if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
      select.value = currentValue;
    }
  }

  /* ---- 편집 패널 표시/숨기기 ---- */
  function updateEditPanel() {
    const editPanel = document.getElementById('edit-panel');
    const editNameInput = document.getElementById('edit-node-name');

    if (selectedNodeId) {
      const node = findNode(selectedNodeId);
      if (node) {
        editPanel.classList.add('visible');
        editNameInput.value = node.text;

        // 편집 색상 선택기에서 현재 색상 활성화
        const editSwatches = document.querySelectorAll('#edit-color-picker .color-swatch');
        editSwatches.forEach(swatch => {
          swatch.classList.toggle('active', swatch.dataset.color === node.color);
        });
        return;
      }
    }
    editPanel.classList.remove('visible');
  }

  /* ---- 카메라 부드럽게 이동 (애니메이션) ---- */
  function animateCameraTo(targetX, targetY) {
    const startX = camera.x;
    const startY = camera.y;
    const duration = 400;
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out 함수 (수학의 지수감쇠 곡선!)
      const ease = 1 - Math.pow(1 - progress, 3);
      
      camera.x = startX + (targetX - startX) * ease;
      camera.y = startY + (targetY - startY) * ease;
      render();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  // ==============================================
  // 8단계: 버튼 이벤트 연결
  // ==============================================

  /* ---- 노드 추가 버튼 ---- */
  document.getElementById('add-node-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('input-node-name');
    const parentSelect = document.getElementById('select-parent-node');
    const text = nameInput.value.trim();

    if (!text) return;

    // 부모 노드 결정
    const parentValue = parentSelect.value;
    const parentId = parentValue === 'root' ? null : parseInt(parentValue);

    // 선택된 색상 가져오기
    const activeColor = document.querySelector('#color-picker .color-swatch.active');
    const color = activeColor ? activeColor.dataset.color : '#a855f7';

    // 자동 배치 좌표 계산
    const pos = autoPlaceNode(parentId);
    
    // 노드 생성!
    const newNode = createNode(text, parentId, color, pos.x, pos.y);
    
    // 새 노드 선택 + 카메라 이동
    selectedNodeId = newNode.id;
    animateCameraTo(newNode.x, newNode.y);

    // 입력 필드 초기화
    nameInput.value = '';

    updateSidebar();
    render();
    showToast('✨ 노드가 추가되었어요!');
  });

  /* ---- 색상 선택 (추가 폼) ---- */
  document.querySelectorAll('#color-picker .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#color-picker .color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });
  });

  /* ---- 색상 선택 (편집 패널) ---- */
  document.querySelectorAll('#edit-color-picker .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      if (!selectedNodeId) return;
      const node = findNode(selectedNodeId);
      if (node) {
        node.color = swatch.dataset.color;
        document.querySelectorAll('#edit-color-picker .color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        updateSidebar();
        render();
      }
    });
  });

  /* ---- 노드 편집 저장 ---- */
  document.getElementById('btn-edit-save').addEventListener('click', () => {
    if (!selectedNodeId) return;
    const node = findNode(selectedNodeId);
    const newName = document.getElementById('edit-node-name').value.trim();
    if (node && newName) {
      node.text = newName;
      updateSidebar();
      render();
      showToast('✅ 노드가 수정되었어요!');
    }
  });

  /* ---- 노드 삭제 ---- */
  document.getElementById('btn-delete-node').addEventListener('click', () => {
    if (!selectedNodeId) return;
    
    const node = findNode(selectedNodeId);
    const childCount = getChildren(selectedNodeId).length;
    
    let message = `"${node.text}" 노드를 삭제할까요?`;
    if (childCount > 0) {
      message += `\n⚠️ 하위 노드 ${childCount}개도 함께 삭제됩니다!`;
    }
    
    if (confirm(message)) {
      deleteNodeAndChildren(selectedNodeId);
      selectedNodeId = null;
      updateSidebar();
      render();
      showToast('🗑️ 노드가 삭제되었어요');
    }
  });

  /* ---- 줌 버튼 ---- */
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    camera.zoom = Math.min(camera.zoom * 1.2, 3);
    render();
  });

  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    camera.zoom = Math.max(camera.zoom * 0.8, 0.2);
    render();
  });

  document.getElementById('btn-zoom-fit').addEventListener('click', () => {
    fitAllNodes();
  });

  /* ---- 전체 보기 (모든 노드가 화면에 들어오도록) ---- */
  function fitAllNodes() {
    if (nodes.length === 0) {
      camera.x = 0;
      camera.y = 0;
      camera.zoom = 1;
      render();
      return;
    }

    // 모든 노드의 바운딩 박스 계산
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.x - node.width / 2);
      maxX = Math.max(maxX, node.x + node.width / 2);
      minY = Math.min(minY, node.y - node.height / 2);
      maxY = Math.max(maxY, node.y + node.height / 2);
    });

    const wrapper = document.getElementById('canvas-wrapper');
    const viewW = wrapper.clientWidth;
    const viewH = wrapper.clientHeight;
    
    const contentW = maxX - minX + 100; // 여유 패딩
    const contentH = maxY - minY + 100;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 줌 계산 (컨텐츠가 화면에 맞도록)
    const zoomX = viewW / contentW;
    const zoomY = viewH / contentH;
    const newZoom = Math.min(zoomX, zoomY, 2);

    animateCameraTo(centerX, centerY);
    camera.zoom = Math.max(newZoom, 0.3);
    render();
  }

  /* ---- 내보내기 (캔버스를 이미지로 저장) ---- */
  document.getElementById('btn-export').addEventListener('click', () => {
    // 현재 캔버스를 PNG로 변환
    const link = document.createElement('a');
    
    // 학번/이름/과목 정보를 파일명에 포함
    const studentId = document.getElementById('input-student-id').value || 'mindmap';
    const studentName = document.getElementById('input-student-name').value || '';
    const subject = document.getElementById('input-subject').value || '';
    
    const filename = [studentId, studentName, subject].filter(Boolean).join('_') + '.png';
    
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('📥 이미지가 저장되었어요!');
  });

  /* ---- 전체 초기화 ---- */
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (nodes.length === 0) return;
    if (confirm('정말 모든 노드를 삭제할까요? 🤔')) {
      nodes = [];
      nodeIdCounter = 0;
      selectedNodeId = null;
      camera.x = 0;
      camera.y = 0;
      camera.zoom = 1;
      updateSidebar();
      render();
      showToast('🔄 마인드맵이 초기화되었어요');
    }
  });

  // ==============================================
  // 9단계: 상단 입력 바 → 루트 노드 자동 생성
  // 학번/이름/과목을 입력하면 자동으로 중앙에 표시!
  // ==============================================
  function updateRootFromHeader() {
    const studentId = document.getElementById('input-student-id').value.trim();
    const name = document.getElementById('input-student-name').value.trim();
    const subject = document.getElementById('input-subject').value.trim();

    // 아무것도 입력 안 했으면 무시
    if (!studentId && !name && !subject) return;

    // 루트 노드 텍스트 조합
    const parts = [subject, name, studentId].filter(Boolean);
    const rootText = parts.join(' · ');

    // 이미 "헤더 루트 노드"가 있는지 확인
    const existingRoot = nodes.find(n => n.parentId === null && n._isHeaderRoot);
    
    if (existingRoot) {
      // 기존 루트 노드 텍스트 업데이트
      existingRoot.text = rootText;
    } else {
      // 새 루트 노드 생성
      const wrapper = document.getElementById('canvas-wrapper');
      const centerX = wrapper.clientWidth / 2;
      const centerY = wrapper.clientHeight / 2;
      const newRoot = createNode(rootText, null, '#a855f7', centerX, centerY);
      newRoot._isHeaderRoot = true; // 헤더에서 만든 노드임을 표시
      selectedNodeId = newRoot.id;
      
      // 부모 선택 드롭다운에서 이 루트를 기본값으로
      setTimeout(() => {
        document.getElementById('select-parent-node').value = newRoot.id;
      }, 50);
    }

    updateSidebar();
    render();
  }

  // 입력 필드에 변화가 있을 때마다 루트 노드 갱신
  ['input-student-id', 'input-student-name', 'input-subject'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateRootFromHeader);
  });

  // ==============================================
  // 10단계: 토스트 알림 (피드백 메시지)
  // ==============================================
  function showToast(message) {
    // 기존 토스트 제거
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 2.5초 후 자동 제거
    setTimeout(() => toast.remove(), 2500);
  }

  // ==============================================
  // 11단계: 🔒 윤리 핵심가이드 게이트 제어 시스템
  // 비유: 검문소의 임시 통행증(sessionStorage)을 확인하는 논리구조예요!
  // 브라우저 탭을 닫으면 통행증이 만료되어 다음 접속 시 다시 확인해야 해요.
  // ==============================================
  const ethicsGate = document.getElementById('ethics-gate');
  const btnEthicsAgree = document.getElementById('btn-ethics-agree');

  // 세션 스토리지에 동의 내역이 있는지 확인
  const isEthicsApproved = sessionStorage.getItem('ethics-approved');

  if (isEthicsApproved === 'true') {
    // 세션 중에 이미 동의했다면 오버레이를 감춤
    ethicsGate.classList.add('hidden');
  }

  // 동의 서약 버튼 클릭 이벤트 핸들러
  btnEthicsAgree.addEventListener('click', () => {
    // 세션 스토리지에 서약 기록 저장 (브라우저 창 닫을 때까지 유지)
    sessionStorage.setItem('ethics-approved', 'true');
    
    // 오버레이에 hidden 클래스를 넣어 슬라이드 아웃 애니메이션 실행
    ethicsGate.classList.add('hidden');
    
    // 축하 메시지 띄우기
    showToast('🚀 윤리 실천 약속 완료! 활동을 시작합니다.');
  });

  // ==============================================
  // 12단계: 📄 이용약관 & 개인정보처리방침 모달 제어 시스템
  // 비유: 탭을 누르면 해당 칠판(탭 화면)만 보여주는 시스템이에요!
  // ==============================================
  const termsModal = document.getElementById('terms-modal');
  const linkTerms = document.getElementById('link-terms');
  const linkPrivacy = document.getElementById('link-privacy');
  const btnModalClose = document.getElementById('btn-modal-close');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // 모달 열기 함수
  function openModal(activeTabId) {
    termsModal.classList.add('visible');
    switchTab(activeTabId);
  }

  // 모달 닫기 함수
  function closeModal() {
    termsModal.classList.remove('visible');
  }

  // 탭 전환 함수
  function switchTab(tabId) {
    // 탭 버튼 활성화 상태 조절
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // 탭 내용 활성화 상태 조절
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
  }

  // 푸터 링크 클릭 시 모달 열기
  linkTerms.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('tab-terms');
  });

  linkPrivacy.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('tab-privacy');
  });

  // 닫기 버튼 클릭
  btnModalClose.addEventListener('click', closeModal);

  // 모달 뒷배경 클릭 시 닫기
  termsModal.addEventListener('click', (e) => {
    if (e.target === termsModal) {
      closeModal();
    }
  });

  // 탭 버튼 클릭 이벤트 연결
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // ==============================================
  // 🚀 초기화: 앱 시작!
  // ==============================================
  resizeCanvas();

  // 시작 시 카메라를 캔버스 중앙으로
  const wrapper = document.getElementById('canvas-wrapper');
  camera.x = wrapper.clientWidth / 2;
  camera.y = wrapper.clientHeight / 2;

  render();
  updateSidebar();

});
