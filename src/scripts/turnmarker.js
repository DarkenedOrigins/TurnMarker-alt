import { Chatter } from './chatter.js';
import { Marker } from './marker.js';
import { MarkerAnimation } from './markeranimation.js';
import { Settings } from './settings.js';
import { renderUpdateWindow } from './updateWindow.js';
import { firstGM, Flags, FlagScope, socketAction, socketName } from './utils.js';


let lastTurn = '';


Hooks.once('init', () => {
    Settings.registerSettings();
});

Hooks.once('ready', () => {
    if (game.user.isGM) {
        if (isNewerVersion(game.modules.get("turnmarker").data.version, Settings.getVersion())) {
            renderUpdateWindow();
        }
    }
});

Hooks.on('canvasReady', () => {
    let tile = canvas.tiles.placeables.find(t => t.data.flags.turnMarker == true);
    if (tile) {
        tile.zIndex = Math.max(...canvas.tiles.placeables.map(o => o.zIndex)) + 1;
        tile.parent.sortChildren();
        if (!game.paused && Settings.getShouldAnimate()) {
            MarkerAnimation.startAnimation();
        }
    }
});

Hooks.on('createTile', (scene, tile) => {
    if (tile.flags.turnMarker == true) {
        tile = canvas.tiles.placeables.find(t => t.data.flags.turnMarker == true);
        tile.zIndex = Math.max(...canvas.tiles.placeables.map(o => o.zIndex)) + 1;
        tile.parent.sortChildren();
        if (!game.paused && Settings.getShouldAnimate()) {
            MarkerAnimation.startAnimation();
        }
    }
});

Hooks.on('updateCombat', async (combat, update) => {
    // Clear out any leftovers, there seems to be a buggy instance where updateCombat is fired, when combat isn't
    // started nor, is a turn changed
    if (!combat.started) {
        await Marker.deleteStartMarker();
    }
    if (combat.combatant) {
        if (update && lastTurn != combat.combatant._id && game.user.isGM && game.userId == firstGM()) {
            lastTurn = combat.combatant._id;
            if (combat && combat.combatant && combat.started) {
                await Marker.placeStartMarker(game.combat.combatant.token._id)
                let tile = canvas.tiles.placeables.find(t => t.data.flags.turnMarker == true);
                await Marker.placeTurnMarker(combat.combatant.token._id, (tile && tile.id) || undefined);
                if (Settings.getTurnMarkerEnabled()) {
                    await Marker.deleteStartMarker();
                    canvas.scene.unsetFlag(FlagScope, Flags.startMarkerPlaced);
                }
                if (Settings.shouldAnnounceTurns() && !combat.combatant.hidden) {
                    switch (Settings.getAnnounceActors()) {
                        case 0:
                            Chatter.sendTurnMessage(combat.combatant);
                            break;
                        case 1:
                            if (combat.combatant.actor.hasPlayerOwner) {
                                Chatter.sendTurnMessage(combat.combatant);
                            }
                            break;
                        case 2:
                            if (!combat.combatant.actor.hasPlayerOwner) {
                                Chatter.sendTurnMessage(combat.combatant);
                            }
                            break;
                        case 3:
                            Chatter.sendTurnMessage(combat.combatant, true);
                    }
                }
            }
        }
    }
});

Hooks.on('deleteCombat', async () => {
    if (game.user.isGM) {
        await Marker.clearAllMarkers();
    }
    MarkerAnimation.stopAnimation();
});

Hooks.on('updateToken', async (scene, updateToken, updateData) => {
    /*
    Moving preUpdateToken logic here, since pre hooks induce race conditions
     */
    let tile = canvas.tiles.placeables.find(t => t.data.flags.turnMarker == true);
    if (tile) {
        if ((updateData.x || updateData.y || updateData.width || updateData.height || updateData.hidden) &&
            (game && game.combat && game.combat.combatant && game.combat.combatant.tokenId == updateToken._id) &&
            game.user.isGM && game.combat) {
            await Marker.moveMarkerToToken(updateToken._id, tile.id);
            tile.zIndex = Math.max(...canvas.tiles.placeables.map(o => o.zIndex)) + 1;
            tile.parent.sortChildren();
        }
    }
});

Hooks.on('updateTile', async () => {
    if (canvas.scene.data.tokenVision) {
        let tile = canvas.tiles.placeables.find(t => t.data.flags.turnMarker == true);
        if (tile) {
            let combatant = canvas.tokens.placeables.find(x => x.id == game.combat.combatant.tokenId);
            if (combatant && !combatant.data.hidden) {
                tile.visible = canvas.sight.testVisibility(combatant.center, { tolerance: canvas.dimensions.size / 4 });
            }
        }
    }
});

Hooks.on('pauseGame', (isPaused) => {
    if (!isPaused && Settings.getShouldAnimate() && canvas.tiles.placeables.find(t => t.data.flags.turnMarker == true)) {
        MarkerAnimation.startAnimation();
    } else {
        MarkerAnimation.stopAnimation();
    }
});
