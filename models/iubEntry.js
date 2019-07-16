const mongoose = require('mongoose');

/**
 * Schema properties.
 *
 * @property {String} year Year of the fetch
 * @property {String} month Month of the fetch
 * @property {String} day Day of the fetch
 * @property {Date} fetchedAt Timestamp of the fetch
 */
const properties = {
  document_id: {
    type: String,
    unique: false, // since there can be procuremetns with several 'stages' the document ID can be duplicated
    required: true,
  },
  type: String, // only certain types are allowed
  authority_name: String, // authority_name OR general.authority_name TODO: ask if this is correct or can this be under something else
  authority_reg_num: String, // authority_reg_num OR general.authority_reg_num
  price: Number, // contract_price_exact OR part_5_list.part_5.contract_price_exact OR price_exact_eur (maybe also save currency if this one is taken)
  price_from: Number,
  price_to: Number,
  decision_date: String, // under decision_date OR part_5_list.part_5.decision_date
  tender_num: Number, // part_5_list.part_5.tender_num TODO: ask if this can be found elsewhere as well
  currency: Number, // currency
  eu_fund: Boolean,
  winners: [
    {
      winner_name: String, // winner_list.winner.winner_name OR winners.winner.firm
      winner_reg_num: String, // winner_list.winner.winner_reg_num OR winners.winner.reg_num
      winner_reg_date: String, // retreived from Lursoft DB in the format (YYYY-MM-DD)
    }
  ],
};

const schema = new mongoose.Schema(properties);

module.exports = mongoose.model('IUBEntry', schema);
