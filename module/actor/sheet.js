import { SR5 } from '../config.js';
import { Helpers } from '../helpers.js';
/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class SR5ActorSheet extends ActorSheet {
  get data() {
    return this.actor.data.data;
  }

  constructor(...args) {
    super(...args);

    /**
     * Keep track of the currently active sheet tab
     * @type {string}
     */
    this._sheetTab = "skills";
    this._shownUntrainedSkills = [];
  }

  /* -------------------------------------------- */

  /**
   * Extend and override the default options used by the 5e Actor Sheet
   * @returns {Object}
   */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
  	  classes: ["sr5", "sheet", "actor"],
  	  template: "systems/shadowrun5e/templates/actor/character.html",
      width: 600,
      height: 600
    });
  }


  /* -------------------------------------------- */

  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  getData() {
    this.actor.data = this.actor.prepareData(this.actor.data);
    const data = super.getData();

    // do some calculations
    const limits = data.data.limits;
    if (limits.physical.mod === 0) delete limits.physical.mod;
    if (limits.social.mod === 0) delete limits.social.mod;
    if (limits.mental.mod === 0) delete limits.mental.mod;
    const movement = data.data.movement;
    if (movement.walk.mult === 1 || movement.walk.mult === 0) delete movement.walk.mult;
    if (movement.run.mult === 2 || movement.run.mult === 0) delete movement.run.mult;
    const track = data.data.track;
    if (track.physical.mod === 0) delete track.physical.mod;
    if (track.stun && track.stun.mod === 0) delete track.stun.mod;

    const matrix = data.data.matrix;
    if (matrix.attack.mod === 0) delete matrix.attack.mod;
    if (matrix.sleaze.mod === 0) delete matrix.sleaze.mod;
    if (matrix.data_processing.mod === 0) delete matrix.data_processing.mod;
    if (matrix.firewall.mod === 0) delete matrix.firewall.mod;

    this._prepareItems(data);
    this._prepareSkills(data);

    data.config = CONFIG.SR5;

    return data;
  }

  _prepareSkills(data) {
    const categories = SR5.skills.categories;
    const skillCategories = {};
    for (let category of Object.values(categories)) {
      skillCategories[category.label] = {
        skills: {}
      };
      const skills = [];
      for (let sid of category.skills) {
        const skill = data.data.skills.active[sid];
        skills.push(skill);
        skill.css = skill.value > 0 ? '' : 'hidden';
        // skillCategories[category.label].skills[sid] = skill;
      }
      skills.sort((a,b) => {
        let diff = b.value - a.value;
        if (diff === 0) {
          diff = a.label.charCodeAt(0) - b.label.charCodeAt(0);
        }
        return diff;
      });
      skills.forEach(skill => skillCategories[category.label].skills[skill.label] = skill);
    }
    data.data.skillCategories = skillCategories;
  }

  _prepareItems(data) {
    const inventory = {
      weapon: {
        label: "Weapon",
        items: [],
        dataset: {
          type: 'weapon'
        }
      },
      armor: {
        label: "Armor",
        items: [],
        dataset: {
          type: 'armor'
        }
      },
      device: {
        label: "Device",
        items: [],
        dataset: {
          type: 'device'
        }
      },
      equipment: {
        label: "Equipment",
        items: [],
        dataset: {
          type: 'equipment'
        }
      },
      cyberware: {
        label: "Cyberware",
        items: [],
        dataset: {
          type: 'cyberware'
        }
      }
    };
    const spellbook = {
      combat: {
        label: "Combat",
        items: [],
        dataset: {
          type: 'combat'
        }
      },
      detection: {
        label: "Detection",
        items: [],
        dataset: {
          type: 'detection'
        }
      },
      health: {
        label: "Health",
        items: [],
        dataset: {
          type: 'health'
        }
      },
      illusion: {
        label: "Illusion",
        items: [],
        dataset: {
          type: 'illusion'
        }
      },
      manipulation: {
        label: "Manipulation",
        items: [],
        dataset: {
          type: 'manipulation'
        }
      }
    };

    let [items, spells, qualities, adept_powers, critter_power] = data.items.reduce((arr, item) => {
      item.img = item.img || DEFAULT_TOKEN;
      item.isStack = item.data.quantity ? item.data.quantity > 1 : false;

      if (item.type === 'spell') arr[1].push(item);
      else if (item.type === 'quality') arr[2].push(item);
      else if (item.type === 'adept_power') arr[3].push(item);
      else if (item.type === 'critter_power') arr[4].push(item);
      else if (Object.keys(inventory).includes(item.type)) arr[0].push(item);
      return arr;
    }, [[], [], [], [], []]);

    items.forEach(item => {
      inventory[item.type].items.push(item);
    });
    spells.forEach(spell => {
      spellbook[spell.data.category].items.push(spell);
    });

    data.inventory = Object.values(inventory);
    data.spellbook = Object.values(spellbook);
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Activate tabs
    let tabs = html.find('.tabs');
    let initial = this._sheetTab;
    new Tabs(tabs, {
      initial: initial,
      callback: clicked => this._sheetTab = clicked.data("tab")
    });

    html.find('.hidden').hide();
    this._shownUntrainedSkills.forEach(cat => {
      console.log(cat);
      const field = $(`[data-category='${cat}']`);
      console.log(field);
      field.siblings('.item.hidden').show();
    });

    html.find('.skill-header').click(event => {
      event.preventDefault();
      const category = event.currentTarget.dataset.category;
      const field = $(event.currentTarget).siblings('.item.hidden');
      field.toggle();
      if (field.is(':visible')) this._shownUntrainedSkills.push(category);
      else this._shownUntrainedSkills = this._shownUntrainedSkills.filter(val => val !== category);
    });

    html.find('.attribute-roll').click(this._onRollAttribute.bind(this));
    html.find('.skill-roll').click(this._onRollActiveSkill.bind(this));
    html.find('.defense-roll').click(this._onRollDefense.bind(this));
    html.find('.attribute-only-roll').click(this._onRollAttributesOnly.bind(this));
    html.find('.soak-roll').click(this._onRollSoak.bind(this));
    html.find('.item-roll').click(this._onRollItem.bind(this));
    html.find('.item-equip-toggle').click(this._onEquipItem.bind(this));

    // Update Inventory Item
    html.find('.item-edit').click(event => {
      event.preventDefault();
      const iid = parseInt(event.currentTarget.dataset.item);
      const item = this.actor.getOwnedItem(iid);
      item.sheet.render(true);
    });



    // Delete Inventory Item
    html.find('.item-delete').click(event => {
      event.preventDefault();
      const iid = parseInt(event.currentTarget.dataset.item);
      const el = $(event.currentTarget).parents(".item");
      this.actor.deleteOwnedItem(iid);
      el.slideUp(200, () => this.render(false));
    });
  }

  async _onEquipItem(event) {
    event.preventDefault();
    const iid = parseInt(event.currentTarget.dataset.item);
    const item = this.actor.getOwnedItem(iid);
    if (item) {
      const itemData = item.data.data;
      // if we will be equipping and it is a device
      if (!itemData.technology.equipped && item.type === 'device') {
        for (let ite of this.actor.items) {
          if (ite.type === 'device' && ite.data.data.technology.equipped) {
            ite.data.data.technology.equipped = false;
            this.actor.updateOwnedItem(ite.data);
          };
        }
      }
      if (itemData.technology) itemData.technology.equipped = !itemData.technology.equipped;
      this.actor.updateOwnedItem(item.data);
    }

  }

  async _onRollItem(event) {
    event.preventDefault();
    const iid = parseInt(event.currentTarget.dataset.item);
    const item = this.actor.getOwnedItem(iid);
    console.log(item);
    item.roll();
  }

  async _onRollDefense(event) {
    event.preventDefault();
    const defense = event.currentTarget.dataset.roll;
    this.actor.rollDefense(defense, {event: event});
  }

  async _onRollSoak(event) {
    event.preventDefault();
    const soak = event.currentTarget.dataset.soak;
    this.actor.rollSoak(soak, {event: event});
  }

  async _onRollAttributesOnly(event) {
    event.preventDefault();
    const roll = event.currentTarget.dataset.roll;
    this.actor.rollAttributesTest(roll, {event: event});
  }

  async _onRollActiveSkill(event) {
    event.preventDefault();
    const skill = event.currentTarget.dataset.skill;
    this.actor.rollActiveSkill(skill, {event: event});
  }

  async _onRollAttribute(event) {
    event.preventDefault();
    const attr = event.currentTarget.dataset.attribute;
    this.actor.rollAttribute(attr, {event: event});
  }



  /* -------------------------------------------- */

  /**
   * Implement the _updateObject method as required by the parent class spec
   * This defines how to update the subject of the form when the form is submitted
   * @private
   */
  _updateObject(event, formData) {
    console.log(formData);
    // Update the Actor
    return this.object.update(formData);
  }
}
