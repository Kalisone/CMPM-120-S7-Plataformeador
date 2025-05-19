class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 1200;
        this.DRAG = 2400;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -600;
        this.MAX_SPEED = 200;
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 2.0;

        this.wasInAir = this.inAir = false;

        my.score = 0;
    }

    create() {
        // SFX
        this.jump1 = this.sound.add("jump", {volume: 0.8});
        this.jump2 = this.sound.add("up", {volume: 0.8});

        this.coin1 = this.sound.add("moneyUp", {volume: 0.6});
        this.coin2 = this.sound.add("moneyTone", {volume: 0.6});
        
        this.steps = [
            this.sound.add("grassStep_0"),
            this.sound.add("grassStep_1"),
            this.sound.add("grassStep_2"),
            this.sound.add("grassStep_3"),
            this.sound.add("grassStep_4")
        ];
        this.stepCounter = 0;

        this.hardStep = this.sound.add("hardStep_0", {volume: 0.8});
        this.softStep = this.sound.add("softStep_0", {volume: 1});

        // VFX
        if(!this.anims.get("coinAnim")){
            my.vfx.coinAnim = this.anims.create({
                key: "coinAnim",
                frames: [
                    {key: "kenny-particles", frame: "flare_01.png"},
                    {key: "kenny-particles", frame: "light_01.png"},
                    {key: "kenny-particles", frame: "light_02.png"},
                    {key: "kenny-particles", frame: "light_03.png"}
                ],
                duration: 300,
                frameRate: 10
            });
        }
        
        if(!this.anims.get("waterAnim")){
            my.vfx.waterAnim = this.anims.create({
                key: "waterAnim",
                frames: [
                    {key: "kenny-particles", frame: "smoke_04.png"},
                    {key: "kenny-particles", frame: "circle_01.png"},
                    {key: "kenny-particles", frame: "smoke_07.png"},
                    {key: "kenny-particles", frame: "circle_04.png"},
                    {key: "kenny-particles", frame: "smoke_08.png"}
                ],
                duration: 300,
                frameRate: 10
            });
        }

        if(!this.anims.get("landingAnim")){
            my.vfx.landingAnim = this.anims.create({
                key: "landingAnim",
                frames: [
                    {key: "kenny-particles", frame: "smoke_01.png"},
                    {key: "kenny-particles", frame: "smoke_02.png"},
                    {key: "kenny-particles", frame: "smoke_03.png"},
                    {key: "kenny-particles", frame: "smoke_04.png"},
                    {key: "kenny-particles", frame: "smoke_05.png"},
                    {key: "kenny-particles", frame: "smoke_06.png"},
                    {key: "kenny-particles", frame: "smoke_07.png"},
                    {key: "kenny-particles", frame: "smoke_08.png"},
                    {key: "kenny-particles", frame: "smoke_09.png"}
                ],
                duration: 150
            });
        }

        // Create a new tilemap game object which uses 18x18 pixel tiles, and is
        // 45 tiles wide and 25 tiles tall.
        this.map = this.add.tilemap("platformer-level-1", 18, 18, 45, 25);

        // Add a tileset to the map
        // First parameter: name we gave the tileset in Tiled
        // Second parameter: key for the tilesheet (from this.load.image in Load.js)
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");

        // Create a layer
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);

        // Make it collidable
        this.groundLayer.setCollisionByProperty({
            collides: true
        });

        // TODO: Add createFromObjects here
        // Find coins in the "Objects" layer in Phaser
        // Look for them by finding objects with the name "coin"
        // Assign the coin texture from the tilemap_sheet sprite sheet
        // Phaser docs:
        // https://newdocs.phaser.io/docs/3.80.0/focus/Phaser.Tilemaps.Tilemap-createFromObjects

        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });

        // TODO: Add turn into Arcade Physics here
        // Since createFromObjects returns an array of regular Sprites, we need to convert 
        // them into Arcade Physics sprites (STATIC_BODY, so they don't move) 
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);

        // Create a Phaser group out of the array this.coins
        // This will be used for collision detection below.
        this.coinGroup = this.add.group(this.coins);
        
        // Water VFX
        this.waterTiles = this.groundLayer.filterTiles(tile => {
            return tile.properties.water == true;
        });

        my.vfx.particleWater = [];
        for(let water of this.waterTiles){
            my.vfx.particleWater.push(this.add.particles(water.pixelX + water.width/2, water.pixelY, "kenny-particles", {
                anim: ["waterAnim"],
                frequency: my.vfx.waterAnim.msPerFrame,
                lifespan: my.vfx.waterAnim.duration,
                scale: () => 0.04 * (1 + (Math.random() ** 2)),
                alpha: {start: 0.2, end: 0.08, ease: "sine.out"},
                speed: {min: 0, max: 100},
                gravityY: -200,
                radial: true,
                advance: 10,
                blendMode: "ADD"
            }));
        }

        // set up player avatar
        const spawnPt = this.map.findObject("Objects", obj => obj.name === "spawn");
        my.sprite.player = this.physics.add.sprite(spawnPt.x, spawnPt.y, "platformer_characters", "tile_0000.png");
        my.sprite.player.setCollideWorldBounds(true);
        my.sprite.player.body.maxVelocity.x = this.MAX_SPEED;

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Coin VFX
        my.vfx.particleCoin = this.add.particles(0, 0, "kenny-particles", {
            anim: "coinAnim",
            scale: {start: 0.03, end: 0.2},
            frequency: my.vfx.coinAnim.msPerFrame,
            lifespan: my.vfx.coinAnim.duration,
            alpha: {start: 0.2, end: 0.1},
            blendMode: "ADD"
        }).stop();

        // TODO: Add coin collision handler
        // Handle collision detection with coins
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
            this.collectCoin(obj1, obj2);
        })

        // set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();

        this.rKey = this.input.keyboard.addKey('R');

        // debug key listener (assigned to D key)
        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = this.physics.world.drawDebug ? false : true
            this.physics.world.debugGraphic.clear()
        }, this);
        this.physics.world.drawDebug = false;

        // TODO: Add movement vfx here
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            // TODO: Try: add random: true
            random: true,
            scale: {start: 0.02, end: 0.04},
            // TODO: Try: maxAliveParticles: 8,
            maxAliveParticles: 8,
            lifespan: 150,
            // TODO: Try: gravityY: -400,
            gravityY: -400,
            alpha: {start: 1, end: 0.1}
        }).stop();

        my.vfx.landing = this.add.particles(0, 0, "kenny-particles", {
            anim: "landingAnim",
            scale: {start: 0.04, end: 0.1},
            frequency: my.vfx.landingAnim.msPerFrame,
            lifespan: my.vfx.landingAnim.duration,
            gravityY: -400
        }).stop();

        // Score
        my.text.score = this.add.text(20, 20, "Coins Collected: 0",{
            fontFamily: "'Jersey 10'",
            style: "regular",
            fontSize: '36px',
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2
        });

        // TODO: add camera code here
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1); // (target, [,roundPixels][,lerpX][,lerpY])
        this.cameras.main.setDeadzone(20, 20);
        this.cameras.main.setZoom(SCALE);
        this.cameras.main.setBackgroundColor('#ccccff');

        for(let key in my.text){
            this.cameras.main.ignore(my.text[key]);
        }

        this.cameraUI = this.cameras.add()
        for(let key in my.sprite){
            this.cameraUI.ignore(my.sprite[key]);
        }

        for(let key in my.vfx){
            this.cameraUI.ignore(my.vfx[key]);
        }

        /*
        for(let key in my.tileLayers){
            this.cameraUI.ignore(my.tileLayers[key]);
        }
        */

        this.cameraUI.ignore(this.groundLayer);
        this.cameraUI.ignore(this.coins);

        //this.animatedTiles.init(this.map);
    }

    update() {
        this.stepCounter++;
        if(cursors.left.isDown && !cursors.right.isDown) {
            my.sprite.player.setAccelerationX(-this.ACCELERATION);
            my.sprite.player.resetFlip();
            my.sprite.player.anims.play('walk', true);
            // TODO: add particle following code here
            my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/4, my.sprite.player.displayHeight/2 - 5, false);
            my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);

            // Only play smoke effect if touching the ground
            if (my.sprite.player.body.blocked.down) {
                this.fxPlayerWalk();
            }

        }
        if(cursors.right.isDown && !cursors.left.isDown) {
            my.sprite.player.setAccelerationX(this.ACCELERATION);
            my.sprite.player.setFlip(true, false);
            my.sprite.player.anims.play('walk', true);
            // TODO: add particle following code here
            my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth/4, my.sprite.player.displayHeight/2 - 5, false);
            my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);

            // Only play smoke effect if touching the ground
            if (my.sprite.player.body.blocked.down) {
                this.fxPlayerWalk();
            }

        }
        if((cursors.left.isDown && cursors.right.isDown) || !(cursors.left.isDown || cursors.right.isDown)){
            // Set acceleration to 0 and have DRAG take over
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);
            my.sprite.player.anims.play('idle');
            // TODO: have the vfx stop playing
            my.vfx.walking.stop();
        }

        // player jump
        // note that we need body.blocked rather than body.touching b/c the former applies to tilemap tiles and the latter to the "ground"
        if(!my.sprite.player.body.blocked.down) {
            my.sprite.player.anims.play('jump');
            my.vfx.walking.stop();

            this.wasInAir = this.inAir;
            this.inAir = true;
        }else{
            this.wasInAir = this.inAir;
            this.inAir = false;
        }
        if(my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
            my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
            this.jump1.play();
            this.jump2.play();
        }

        if(this.inAir === false && this.wasInAir === true){
            my.vfx.landing.emitParticleAt(my.sprite.player.x, my.sprite.player.y + (my.sprite.player.displayHeight / 2));

            this.hardStep.play();
            this.softStep.play();
        }

        if(Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.scene.restart();
        }
    }

    fxPlayerWalk(){
        my.vfx.walking.start();

        if(this.stepCounter >= 15){
            this.steps[Math.round(Math.random() * (this.steps.length-1))].play({volume: 0.5});
            this.stepCounter = 0;
        }
    }

    collectCoin(obj1, obj2){
        my.vfx.particleCoin.emitParticleAt(obj2.x, obj2.y);
        obj2.destroy(); // remove coin on overlap
        
        my.text.score.setText("Coins Collected: " + ++my.score);

        this.coin1.play();
        this.coin2.play();

        return;
    }
}