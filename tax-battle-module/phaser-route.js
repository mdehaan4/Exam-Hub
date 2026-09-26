import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js';

function makeNpc(scene, x, y, color, accent, name) {
  const npc = scene.add.container(x, y);
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x1a1d1f, 0.18);
  shadow.fillEllipse(0, 18, 18, 8);
  npc.add(shadow);

  const body = scene.add.graphics();
  body.fillStyle(accent, 1);
  body.fillRoundedRect(-8, -4, 16, 8, 4);
  body.fillStyle(color, 1);
  body.fillCircle(0, -10, 8);
  body.fillStyle(0x1f2937, 1);
  body.fillRect(-7, 3, 6, 11);
  body.fillRect(1, 3, 6, 11);
  body.fillStyle(0xf8fafc, 1);
  body.fillRect(-4, -13, 2, 2);
  body.fillRect(2, -13, 2, 2);
  npc.add(body);

  const labelText = scene.add.text(-18, -24, name, {
    fontFamily: 'Arial',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#f8fafc',
  });
  npc.add(labelText);
  npc.setDepth(7);
  return npc;
}

function makePhaserRoute() {
  const stageEl = document.getElementById('worldStage');
  if (!stageEl || stageEl.dataset.phaserReady === 'true') return;

  stageEl.dataset.phaserReady = 'true';

  const sceneConfig = {
    key: 'RouteScene',
    create() {
      const width = 860;
      const height = 500;
      const worldWidth = 1800;
      const worldHeight = 1200;

      this.cameras.main.setBackgroundColor('#7ccf6c');
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.setRoundPixels(true);

      const zoneAreas = [
        { name: 'Maple Town', x: 0, y: 0, w: 560, h: 440, color: 0x9bdc76 },
        { name: 'Meadow Trail', x: 560, y: 0, w: 520, h: 440, color: 0x95d36e },
        { name: 'Lake Edge', x: 1080, y: 0, w: 720, h: 420, color: 0x8bc86d },
        { name: 'Forest Bend', x: 0, y: 440, w: 680, h: 760, color: 0x7fc261 },
        { name: 'South Loop', x: 680, y: 440, w: 1120, h: 760, color: 0x7abf67 },
      ];

      const ground = this.add.graphics();
      zoneAreas.forEach((zone) => {
        ground.fillStyle(zone.color, 1);
        ground.fillRect(zone.x, zone.y, zone.w, zone.h);
      });
      ground.fillStyle(0xa7e187, 1);
      for (let y = 0; y < worldHeight; y += 26) {
        for (let x = 0; x < worldWidth; x += 26) {
          const variation = (x * 0.6 + y * 0.4) % 10;
          ground.fillRect(x, y, 24, 12 + (variation > 5 ? 4 : 0));
        }
      }

      const grassPatch = this.add.graphics();
      grassPatch.fillStyle(0x80cc66, 0.92);
      grassPatch.fillEllipse(180, 180, 180, 40);
      grassPatch.fillEllipse(720, 170, 180, 42);
      grassPatch.fillEllipse(1260, 260, 220, 52);
      grassPatch.fillEllipse(360, 860, 210, 45);
      grassPatch.fillEllipse(1180, 890, 210, 48);

      const townDetail = this.add.graphics();
      townDetail.fillStyle(0xefe0a9, 0.9);
      townDetail.fillRoundedRect(130, 120, 120, 60, 10);
      townDetail.fillRoundedRect(260, 120, 120, 60, 10);
      townDetail.fillStyle(0x9ecb7c, 0.9);
      townDetail.fillRoundedRect(160, 330, 210, 42, 8);

      const meadowDetail = this.add.graphics();
      meadowDetail.fillStyle(0x9edc7d, 0.8);
      for (let i = 0; i < 8; i += 1) {
        meadowDetail.fillEllipse(620 + i * 70, 110 + (i % 2) * 20, 50, 18);
      }

      const lakeDetail = this.add.graphics();
      lakeDetail.fillStyle(0x8ccbf4, 0.22);
      lakeDetail.fillEllipse(1210, 120, 250, 90);
      lakeDetail.fillEllipse(1460, 150, 210, 70);
      lakeDetail.fillStyle(0x5aa4d3, 0.38);
      lakeDetail.fillEllipse(1380, 140, 45, 18);

      const forestDetail = this.add.graphics();
      forestDetail.fillStyle(0x5e8d52, 0.2);
      for (let i = 0; i < 9; i += 1) {
        forestDetail.fillEllipse(100 + i * 70, 620 + (i % 3) * 30, 70, 26);
      }

      const southDetail = this.add.graphics();
      southDetail.fillStyle(0xb8d87b, 0.3);
      southDetail.fillEllipse(820, 700, 220, 70);
      southDetail.fillEllipse(1300, 760, 240, 80);

      const path = this.add.graphics();
      path.fillStyle(0xd9b487, 1);
      path.fillRect(0, 520, worldWidth, 150);
      path.fillStyle(0xc18b5b, 1);
      path.fillRect(0, 534, worldWidth, 18);
      path.fillRect(0, 628, worldWidth, 14);
      path.fillStyle(0xc79d6b, 1);
      path.fillRect(560, 0, 180, worldHeight);
      path.fillStyle(0xaa7e51, 1);
      path.fillRect(580, 0, 12, worldHeight);
      path.fillRect(710, 0, 12, worldHeight);
      path.fillStyle(0x9a6d4a, 0.45);
      path.fillRect(0, 520, worldWidth, 150);

      const pondA = this.add.graphics();
      pondA.fillStyle(0x63b7eb, 0.9);
      pondA.fillEllipse(220, 870, 220, 72);
      pondA.fillStyle(0x8bd0f5, 0.38);
      pondA.fillEllipse(220, 870, 150, 42);
      pondA.lineStyle(3, 0x4ea7dc, 1);
      pondA.strokeEllipse(220, 870, 220, 72);

      const pondB = this.add.graphics();
      pondB.fillStyle(0x63b7eb, 0.92);
      pondB.fillEllipse(1430, 260, 220, 72);
      pondB.fillStyle(0x8bd0f5, 0.42);
      pondB.fillEllipse(1430, 260, 150, 42);
      pondB.lineStyle(3, 0x4ea7dc, 1);
      pondB.strokeEllipse(1430, 260, 220, 72);

      const grassHills = this.add.graphics();
      grassHills.fillStyle(0x5fa85d, 1);
      grassHills.fillEllipse(260, 270, 100, 32);
      grassHills.fillEllipse(980, 240, 110, 34);
      grassHills.fillEllipse(1360, 770, 120, 34);
      grassHills.fillEllipse(700, 980, 125, 32);

      const treePositions = [
        [120, 270], [260, 220], [350, 180], [530, 270], [770, 310], [980, 180], [1220, 270], [1500, 200],
        [160, 760], [380, 690], [560, 820], [900, 760], [1160, 720], [1480, 760], [960, 1040], [1320, 1020], [1560, 930],
        [300, 980], [740, 430], [1080, 430], [1320, 520]
      ];

      treePositions.forEach(([x, y]) => {
        const tree = this.add.graphics();
        tree.fillStyle(0x5b412f, 1);
        tree.fillRect(x - 4, y + 18, 8, 20);
        tree.fillStyle(0x3d8c4f, 1);
        tree.fillCircle(x, y, 18);
        tree.fillCircle(x - 12, y + 8, 12);
        tree.fillCircle(x + 12, y + 8, 12);
        tree.fillCircle(x, y - 12, 12);
        tree.fillStyle(0x2d7040, 1);
        tree.fillCircle(x - 4, y + 4, 10);
        tree.fillCircle(x + 7, y + 5, 9);
      });

      const signs = this.add.graphics();
      signs.fillStyle(0x6a4a34, 1);
      signs.fillRect(128, 172, 8, 56);
      signs.fillRect(440, 175, 8, 56);
      signs.fillRect(674, 174, 8, 56);
      signs.fillStyle(0xf6d575, 1);
      signs.fillRoundedRect(108, 152, 50, 18, 5);
      signs.fillRoundedRect(420, 154, 50, 18, 5);
      signs.fillRoundedRect(654, 156, 50, 18, 5);
      signs.fillStyle(0x1a2330, 1);
      const signTextA = this.add.text(118, 154, 'Maple', { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#1a2330' });
      const signTextB = this.add.text(430, 156, 'Route', { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#1a2330' });
      const signTextC = this.add.text(664, 156, 'Civic', { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#1a2330' });
      signTextA.setDepth(4);
      signTextB.setDepth(4);
      signTextC.setDepth(4);

      const fenceSegments = this.add.graphics();
      fenceSegments.lineStyle(3, 0x6d4c3b, 1);
      fenceSegments.beginPath();
      for (let x = 120; x <= 300; x += 14) {
        fenceSegments.moveTo(x, 470);
        fenceSegments.lineTo(x - 6, 482);
      }
      for (let x = 1160; x <= 1480; x += 14) {
        fenceSegments.moveTo(x, 500);
        fenceSegments.lineTo(x - 6, 512);
      }
      fenceSegments.strokePath();

      const fences = this.add.graphics();
      fences.lineStyle(3, 0x6d4c3b, 1);
      fences.beginPath();
      for (let x = 150; x <= 260; x += 12) {
        fences.moveTo(x, 390);
        fences.lineTo(x - 6, 402);
      }
      for (let x = 560; x <= 690; x += 12) {
        fences.moveTo(x, 390);
        fences.lineTo(x - 6, 402);
      }
      fences.strokePath();

      const trainer = this.add.container(180, 620);
      const trainerShadow = this.add.graphics();
      trainerShadow.fillStyle(0x1a1d1f, 0.18);
      trainerShadow.fillEllipse(0, 20, 22, 10);
      trainer.add(trainerShadow);
      const trainerHead = this.add.graphics();
      trainerHead.fillStyle(0xf7d17a, 1);
      trainerHead.fillCircle(0, -10, 10);
      trainerHead.fillStyle(0xffb28d, 1);
      trainerHead.fillRoundedRect(-8, 0, 16, 12, 4);
      trainer.add(trainerHead);
      const trainerBody = this.add.graphics();
      trainerBody.fillStyle(0x3250a8, 1);
      trainerBody.fillRoundedRect(-10, 12, 20, 18, 4);
      trainerBody.fillStyle(0xf8fafc, 1);
      trainerBody.fillRect(-4, -13, 2, 2);
      trainerBody.fillRect(2, -13, 2, 2);
      trainer.add(trainerBody);
      trainer.setDepth(10);

      this.player = trainer;
      this.npcs = [
        makeNpc(this, 300, 620, '#ffb6c1', '#ffe4ef', 'Mira'),
        makeNpc(this, 820, 760, '#9fe7ff', '#d8f6ff', 'Toby'),
        makeNpc(this, 1180, 560, '#c9ff99', '#ecffd8', 'Rae'),
      ];

      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
      });

      this.zoneLabel = this.add.text(24, 18, 'Maple Town', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f9fafb',
        backgroundColor: 'rgba(15,22,32,0.45)',
        padding: { x: 10, y: 6 },
      });
      this.zoneLabel.setDepth(30);
      this.zoneLabel.setScrollFactor(0);

      const vignette = this.add.graphics();
      vignette.fillStyle(0x0f1720, 0.18);
      vignette.fillRect(0, 0, width, 18);
      vignette.fillRect(0, height - 18, width, 18);
      vignette.fillRect(0, 0, 18, height);
      vignette.fillRect(width - 18, 0, 18, height);
      vignette.setScrollFactor(0);

      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    },
    update(time) {
      const speed = 2.1;
      let moveX = 0;
      let moveY = 0;

      if (this.cursors.left.isDown || this.keys.A.isDown) moveX -= speed;
      if (this.cursors.right.isDown || this.keys.D.isDown) moveX += speed;
      if (this.cursors.up.isDown || this.keys.W.isDown) moveY -= speed;
      if (this.cursors.down.isDown || this.keys.S.isDown) moveY += speed;

      if (this.player) {
        this.player.x += moveX;
        this.player.y += moveY;
        this.player.x = Phaser.Math.Clamp(this.player.x, 30, 1770);
        this.player.y = Phaser.Math.Clamp(this.player.y, 30, 1170);

        const zone = [
          { name: 'Maple Town', x: 0, y: 0, w: 560, h: 440 },
          { name: 'Meadow Trail', x: 560, y: 0, w: 520, h: 440 },
          { name: 'Lake Edge', x: 1080, y: 0, w: 720, h: 420 },
          { name: 'Forest Bend', x: 0, y: 440, w: 680, h: 760 },
          { name: 'South Loop', x: 680, y: 440, w: 1120, h: 760 },
        ].find((area) => this.player.x >= area.x && this.player.x <= area.x + area.w && this.player.y >= area.y && this.player.y <= area.y + area.h) || { name: 'Tax District' };

        if (this.zoneLabel) {
          this.zoneLabel.setText(zone.name);
        }
      }

      if (this.npcs) {
        this.npcs.forEach((npc, index) => {
          const drift = Math.sin(time * 0.0018 + index) * 0.9;
          const sway = Math.cos(time * 0.0012 + index) * 0.8;
          npc.x += drift;
          npc.y += sway;
          if (npc.x < 120 || npc.x > 1680) npc.x = Phaser.Math.Clamp(npc.x, 120, 1680);
          if (npc.y < 180 || npc.y > 1040) npc.y = Phaser.Math.Clamp(npc.y, 180, 1040);
        });
      }
    }
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 860,
    height: 500,
    parent: stageEl,
    transparent: true,
    scene: sceneConfig,
    backgroundColor: '#7dcf72',
  });

  window.phaserRouteGame = game;
}

window.initPhaserRoute = makePhaserRoute;
