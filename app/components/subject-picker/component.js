import Ember from 'ember';
import Analytics from '../../mixins/analytics';

function arrayEquals(arr1, arr2) {
    return arr1.length === arr2.length && arr1.reduce((acc, val, i) => acc && val === arr2[i], true);
}

function arrayStartsWith(arr, prefix) {
    return prefix.reduce((acc, val, i) => acc && val && arr[i] && val.id === arr[i].id, true);
}
/**
 * @module ember-preprints
 * @submodule components
 */

/**
 * Add discipline when creating a preprint.
 *
 * Sample usage:
 * ```handlebars
 * {{subject-picker
 *      editMode=editMode
 *      selected=subjectsList
 *      disciplineModifiedToggle=disciplineModifiedToggle
 *      save=(action 'setSubjects')
 *}}
 * ```
 * @class subject-picker
 */
export default Ember.Component.extend(Analytics, {
    store: Ember.inject.service(),
    theme: Ember.inject.service(),

    // Store the lists of subjects
    _tier1: null,
    _tier2: null,
    _tier3: null,

    // Filter the list of subjects if appropriate
    tier1FilterText: '',
    tier2FilterText: '',
    tier3FilterText: '',

    tierSorting: ['text:asc'],
    tier1Filtered: Ember.computed('tier1FilterText', '_tier1.[]', function() {
        let items = this.get('_tier1') || [];
        let filterText = this.get('tier1FilterText').toLowerCase();
        if (filterText) {
            return items.filter(item => item.get('text').toLowerCase().includes(filterText));
        }
        return items;
    }),
    tier1Sorted: Ember.computed.sort('tier1Filtered', 'tierSorting'),

    tier2Filtered: Ember.computed('tier2FilterText', '_tier2.[]', function() {
        let items = this.get('_tier2') || [];
        let filterText = this.get('tier2FilterText').toLowerCase();
        if (filterText) {
            return items.filter(item => item.get('text').toLowerCase().includes(filterText));
        }
        return items;
    }),
    tier2Sorted: Ember.computed.sort('tier2Filtered', 'tierSorting'),

    tier3Filtered: Ember.computed('tier3FilterText', '_tier3.[]', function() {
        let items = this.get('_tier3') || [];
        let filterText = this.get('tier3FilterText').toLowerCase();
        if (filterText) {
            return items.filter(item => item.get('text').toLowerCase().includes(filterText));
        }
        return items;
    }),
    tier3Sorted: Ember.computed.sort('tier3Filtered', 'tierSorting'),

    // Currently selected subjects
    selection1: null,
    selection2: null,
    selection3: null,

    querySubjects(parents = 'null', tier = 0) {
        this.get('theme.provider')
            .then(provider => provider
                .query('taxonomies', {
                    filter: {
                        parents
                    },
                    page: {
                        size: 100
                    }
                })
            )
            .then(results => this
                .set(`_tier${tier + 1}`, results.toArray())
            );
    },

    init() {
        this._super(...arguments);
        this.set('selected', []);
        this.querySubjects();
    },

    actions: {
        deselect(subject) {
            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'button',
                    action: 'click',
                    label: `Preprints - ${this.get('editMode') ? 'Edit' : 'Submit'} - Discipline Remove`
                });
            let index;
            if (subject.length === 1) {
                index = 0;
            } else {
                let parent = subject.slice(0, -1);
                index = this.get('selected').findIndex(item => item !== subject && arrayStartsWith(item, parent));
            }

            let wipe = 4; // Tiers to clear
            if (index === -1) {
                if (this.get(`selection${subject.length}`) === subject[subject.length - 1])
                    wipe = subject.length + 1;
                subject.removeAt(subject.length - 1);
            } else {
                this.get('selected').removeAt(this.get('selected').indexOf(subject));
                for (let i = 2; i < 4; i++) {
                    if (this.get(`selection${i}`) !== subject[i - 1]) continue;
                    wipe = i;
                    break;
                }
            }

            for (let i = wipe; i < 4; i++) {
                this.set(`_tier${i}`, null);
                this.set(`selection${i}`, null);
            }
            this.sendAction('save', this.get('selected'));
        },
        select(selected, tier) {
            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'button',
                    action: 'click',
                    label: `Preprints - ${this.get('editMode') ? 'Edit' : 'Submit'} - Discipline Add`
                });
            tier = parseInt(tier);
            if (this.get(`selection${tier}`) === selected) return;

            this.set(`selection${tier}`, selected);

            // Inserting the subject lol
            let index = -1;
            let selection = [...Array(tier).keys()].map(index => this.get(`selection${index + 1}`));

            // An existing tag has this prefix, and this is the lowest level of the taxonomy, so no need to fetch child results
            if (!(tier !== 3 && this.get('selected').findIndex(item => arrayStartsWith(item, selection)) !== -1)) {
                for (let i = 0; i < selection.length; i++) {
                    let sub = selection.slice(0, i + 1);
                    // "deep" equals
                    index = this.get('selected').findIndex(item => arrayEquals(item, sub));  // jshint ignore:line

                    if (index === -1) continue;

                    this.get('selected')[index].pushObjects(selection.slice(i + 1));
                    break;
                }

                if (index === -1)
                    this.get('selected').pushObject(selection);
            }

            this.sendAction('save', this.get('selected'));

            if (tier === 3) return;

            for (let i = tier + 1; i < 4; i++)
                this.set(`_tier${i}`, null);

            // TODO: Fires a network request every time clicking here, instead of only when needed?
            this.querySubjects(selected.id, tier);
        },
    }
});
