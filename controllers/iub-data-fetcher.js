/**
 * IUB Data Fetcher controller.
 */
const ftpClientInstance = require('ftp');
const fs = require('fs');
const fse = require('fs-extra');
const targz = require('targz');
const xmlParser = require('xml-js');
const IubEntry = require('../models/iubEntry');

/**
 * Include configuration and helpers
 */
const { IUB } = require('../config');
const helpers = require('../helpers');

/**
 * Parses XML file to JSON string.
 *
 * If an entry already exists based on the ID then update it, otherwise create a new one.
 *
 * @param {string} xmlPath - Path to the XML file which needs to be parsed to JSON.
 */
function parseIUBXmlToJson(xmlPath) {
  return new Promise((resolve, reject) => {
    // Read the file
    fs.readFile(xmlPath, 'utf8', (err, data) => {
      if (err) reject(err);

      // Parse XML to JSON
      let parsedData;

      try {
        parsedData = JSON.parse(xmlParser.xml2json(data, { compact: true, spaces: 4 }));
      } catch (e) {
        // console.error(e);
        return resolve(true);
      }

      let {
        id, // PVS dokumenta ID
        authority_name = {}, // Iestādes nosaukums
        authority_reg_num = {}, // Iestādes reģistrācijas Nr.
        general = {}, // { // Vispārējie paziņojuma parametri
          // main_cpv = {}, // Datu bloks satur iepirkuma galveno CPV kodu
        // } = {},
        part_5_list: { // Līguma slēgšanas tiesību piešķiršana
          part_5: { // Saraksts var saturēt vienu vai vairākas paziņojuma par iepirkuma procedūras rezultātiem V daļas (paziņojuma par līguma slēgšanas tiesību piešķiršanu IV daļas) datu struktūras „part_5
            decision_date = {}, // Lēmuma pieņemšanas datums / Līguma slēgšanas datums
            contract_price_exact = {}, // Kopējā līgumcena
            exact_currency = {}, // Kopējā līgumcena – valūta.
            tender_num = {}, // Saņemto piedāvājumu skaits.
            contract_name = {}, // Iepirkuma nosaukums
            creation_date_stamp = {}, // "Attiecīgā datuma unix timestamp vērtība" - tehniskās dokumentācijas
          } = {},
        } = {},
        main_cpv = {},
        part_2 = {},
        winner_list,
        eu_fund,
        additional_info: {
          approval_date = {},
          approval_date_stamp = {},
          update_date = {},
          update_date_stamp = {},
        } = {},
        publication_date = {},
        publication_date_stamp = {},
      } = parsedData.document;

      if (!id || !id._text) {
        return resolve(true);
      }

      /**
       * Schema properties.
       *
       * @property {String} year Year of the fetch
       * @property {String} month Month of the fetch
       * @property {String} day Day of the fetch
       * @property {Date} fetchedAt Timestamp of the fetch
       */
      const properties = {
        document_id: '',
        source_notice: '',
        status: '',
        general: {
          procurement_code: '',
          procurement_id: '',
          main_cpv: {
              code: '',
              code_num: '',
              type: '',
              lv: '',
              en: '',
              cpv_a: '',
              cpv_b: '',
              authority_name: '',
              contract_price_exact: '',
              number_of_participant: '',
              approval_date: '',
          },
          name: '',
          price_from: '',
          price_to: '',
          procurement_type: '',
          authority_id: '',
          authority_name: '',
          authority_reg_num: '',
          address: '',
          city: '',
          zip_code: '',
          country: '',
          procurement_year: '',
          cpv_list: '',
          additional_cpv_list: '',
        },
        main_cpv: {
          code: '',
          code_num: '',
          type: '',
          lv: '',
          en: '',
          cpv_a: '',
          cpv_b: '',
          authority_name: '',
          contract_price_exact: '',
          number_of_participant: '',
          approval_date: '',
        },
        divided_in_parts: '',
        contract_name: '',
        place: '',
        region: '',
        eu_fund: '',
        environment_req: '',
        approval_date_stamp: '',
        parts: '',
        part_5_list: {
          part_5: {
            contract_nr: '',
            part_nr: '',
            concluded_contract_name: '',
            decision_date: '',
            tender_num: '',
            initial_price: '',
            initial_currency: '',
            contract_price_exact: '',
            exact_currency: '',
            contract_price_from: '',
            contract_price_to: '',
            contract_with_vat: '',
            contract_vat_rate: '',
            contract_currency: '',
            subcontracts: '',
            subcontract_price: '',
            subcontract_currency: '',
            subcontract_proportion: '',
            subcontract_unknown: '',
            value_description: '',
            without_results: '',
            interrupted: '',
            interrupt_info: '',
            lower_price: '',
            lower_currency: '',
            contract_count: '',
            product_from_eu: '',
            product_country: '',
            criteria_type: '',
            winner_with_variants: '',
            low_offers: '',
            years_expenses: '',
            months_expenses: '',
            contract_price_exact_lvl: '',
            contract_price_exact_secret_lvl: '',
            contract_price_exact_secret: '',
            exact_currency_secret: '',
            publicate_winner: '',
            party_nr: '',
            party_nr_secret: '',
            winner_list: {
              winner: {
                winner_name: '',
                winner_reg_num: '',
                winner_address: '',
                winner_city: '',
                winner_zip_code: '',
                winner_country: '',
                winner_phone: '',
                winner_fax: '',
                winner_email: '',
                winner_url: '',
                publication_date: '',
                price_exact_eur: '',
              }
            },
          }
        },
        authority_name: '',
        address: '',
        authority_reg_num: '',
        zip_code: '',
        city: '',
        country: '',
        middleman: '',
        creation_date: '',
        creation_date_stamp: '',
        authority_id: '',
        contactplaces: {
          contactplace: {
            type: '',
            name: '',
            short_name: '',
            reg_num: '',
            address: '',
            city: '',
            zip_code: '',
            country: '',
            place: '',
            person: '',
            phone: '',
            fax: '',
            email: '',
            url: '',
            url_client: '',
            procurement_doc_url: '',
            tender_submit_url: '',
          }
        },
        description: '',
        price_exact: '',
        currency: '',
        eu_list: '',
        type: '',
        approval_date: '',
        publication_date: '',
        publication_date_stamp: '',
        statistics_version: '',
        price_exact_eur: '',
        eur_conv_version: '',
        global_winner_title: '',
        global_winner_reg_num: '',
        set_global_data_version: '',
        populate_iub_winners: '',
        archived: '',
        additional_info: {
          approval_date: '',
          approval_date_stamp: '',
          update_date: '',
          update_date_stamp: '',
        },
        part_2: {
          price_exact: '',
          price_exact_eur: '',
        },
        winner_list: {
          winner: {
            winner_name: '',
            winner_reg_num: '',
            winner_address: '',
            winner_city: '',
            winner_zip_code: '',
            winner_country: '',
            winner_phone: '',
            winner_fax: '',
            winner_email: '',
            winner_url: '',
            publication_date: '',
            price_exact_eur: '',
          }
        },
        code: '',
        code_num: '',
        lv: '',
        en: '',
        cpv_a: '',
        cpv_b: '',
        contract_price_exact: '',
        number_of_participant: '',


        // aaa: '',
        // aaa: '',
        // aaa: '',
        supply_price_exact_lvl: '',
        supply_vat_rate: '',
        supply_price_max: '',
        supply_price_min: '',
        supply_price_exact: '',
        supply_with_vat: '',
        supply_currency: '',
        mean_to_short: '',
        mail_text: '',
        use_complaint_file: '',
        customer_email: '',
        applicant_email: '',
        complaint_file: '',
        interlocutory_files: {
          file: {
            checked: '', // boolean
            name: '',
          }
        },
        complaint_files: {
          file: {
            checked: '', // boolean
            name: '',
          }
        },
        parts_list: {
          part: {
            enabled: [],
            checked: [],
            name: [],
            nr: [],
            part_has_complaint: [],
            part_ip_list: [],
          }
        },
        interested_persons: {
          person: [
            {
              name: '',
              email: '',
              use_email: '',
              fax: '',
              participated: '',
            }
          ]
        },
        added_date: '',
        added_date_stamp: '',
        consideration_date_stamp: '',
        submission_date_stamp: '',
        court: '',
        decision_2: '',
        decision: '',
        consideration_minute: '',
        consideration_hour: '',
        consideration_date: '',
        complaint_subject: '',
        funds: '',
        field: '',
        scope: '',
        customer_reg_num: '',
        customer: '',
        applicant: '',
        submission_date: '',
        invitation_number: '',
        eu_fund_info: '',
        authority_types: '',
        procurement_code: '',
        item_list: {
          item: {
            contract_name: '',
            description: '',
            state_procurement: '', // boolean
            service_types: '',
            main_cpv: {
              code: '',
              code_num: '',
              type: '',
              lv: '',
              en: '',
            },
            cpv_list: {
              cpv: '',
            },
            additional_cpv_list: '', // boolean
          }
        },
        criteria: '',
        tenderer_count_max: '',
        tenderer_count_min: '',
        tenderer_count_expected: '',
        previous_open_date: '',
        payment: '',
        scopes_of_activity: '',
        other_type: '',
        notice_point: '',
        old_authority_id: '',
        notice_sent_date: '',
        iub_publication_date: '',
        captcha_test: '',
        publisher_phone: '',
        changes: '',
        no_doc_ext_f14: '',
        price_indications: {
          indication: '',
        },
        docs_minute_to: '',
        docs_hour_to: '',
        docs_minute_from: '',
        docs_hour_from: '',
        docs_date_to: '',
        docs_date_from: '',
        docs_place: '',
        offer_valid_before: '',
        invitation_id: '',
        send_date: '',
        reg_num: '',
        contract_publication_oj_date: '',
        contract_publication_oj_num: '',
        contract_publication_date: '',
        contract_approval_date: '',
        eis_id: '',
        source_notice_has_url3: '', // boolean
        ted_published_url: '',
        design: '',
        linked_notice_id: '',
        subcontract_amount_max: '',
        subcontract_amount_min: '',
        subcontract_info: '',
        other_language: '',
        renewal_details: '',
        renewal: '',
        indefinite: '',
        has_quality_criterion: '',
        cost_criteria_type: '',
        additional_cpv_list: '',
        cpv_list: { // can this be an array?
          cpv: {
            lv: '',
            en: '',
          }
        },
        invitation: '',
        document_is_empty: '',
        search_version: '',
        participation_date: '',
        has_url: '', // boolean
        publish_price: '', // boolean
        changes_info: {
          changes_description: '',
          additional_work: '',
          unexpected_changes: '',
          unexpected_changes_description: '',
          price_before: '',
          currency_before: '',
          price_after: '',
          currency_after: '',
        },
        new_info: {
          place: '',
          region: '',
          description: '',
          contract_months: '',
          contract_days: '',
          contract_start_date: '',
          contract_end_date: '',
          basic_contract_argument: '',
          group_assigned_contract: '',
          contract_price_exact: '',
          exact_currency: '',
          price_exact_lvl: '',
          winner_list: {
            winner: {
              winner_name: '',
              winner_reg_num: '',
              winner_address: '',
              winner_city: '',
              winner_zip_code: '',
              winner_nuts: '',
              winner_country: '',
              winner_phone: '',
              winner_fax: '',
              winner_email: '',
              winner_url: '',
              winner_mvu: '',
            }
          },
          main_cpv: {
            code: '',
            code_num: '',
            type: '',
            lv: '',
            en: '',
          }
        },
        export_version: '',
        tender_mvu_num: '',
        shifted_days_settings: {}, // this has properties as dates e.g.  { 'setting_2017-05-05': { _text: '2017-05-13 ' }
        renewal_enabled: '',
        parent_id: '', // what is this????
        is_staff_qualification: '',
        contract_performance_conditions: '',
        is_profession_reserved: '',
        techical_capacity_document: '', // typo????
        techical_professional_capacity: '',
        is_technical_capacity: '',
        economic_capacity_document: '',
        economic_capacity: '',
        is_economic_capacity: '',
        suitability_professional_activity: '',
        financial_info: '',
        suspension_reason: '',
        has_suspension_of_procedures: '',
        is_suspended: '', // boolean
        is_dinamic_purchasing: '', // typo????
        overall_contract_data: '',
        overall_contract_checked: '',
        overall_contract: '',
        has_middleman_question2: '',
        has_middleman_question1: '',
        procedure_notes: '',
        procedure_regulations_url: '',
        dynamic_purchasing: '',
        procurement_is_terminated: '',
        has_count_parts_client: '',
        max_count_parts: '',
        max_count_parts_client_count: '',
        changes_type: '',
        innovativeSolution_req_detail: '',
        socialResponsibility_req_detail: '',
        range: '',
        has_basic_contract: '',
        candidate_criteria_list: {
          criteria: {
            name: '',
          }
        },
        has_reserved_right_contract: '',
        reserved_right_contract: '',
        has_middleman_question_total_procurement: '',
        has_middleman_question_central_purchasing: '',
        socialResponsibility_req: '',
        innovativeSolution_req: '',
        environment_green_group: '',
        has_url3: '',
        has_url4: '',
        tender_full_url: '',
        included_total_procurement: '',
        one_businessman: '',
        interrupt_date: '',
        interrupted: '', // boolean
        interrupt_user_id: '',
        interruption_date_stamp: '',
        competitor_num: '',
        abroad_competitor_num: '',
        basic_contract_months: '',
        basic_contract_currency: '',
        businessman_num: '',
        max_businessman_num: '',
        basic_contract_years: '',
        basic_contract_argument: '',
        basic_contract_price_from: '',
        basic_contract_price_to: '',
        basic_contract_frequency: '',
        interrupt_info: '',
        invitation_publication_date: '',
        decision_date: '',
        contract_date: '',
        winners: { // can this be an array?
          winner: {
            firm: '',
            reg_num: '',
            address: '',
            country: '',
          },
        },
        offers: { // can this be an array?
          firm: [], // what is the type????
          reg_num: [], // what is the type????
          country: [], // what is the type????
          address: [], // what is the type????
        },
        offers2: '', // can there be offers 3/4/5 etc.?
        notice_send_date: '',
        notice_send_date_stamp: '',
        phone: '',
        fax: '',
        person: '',
        subject: '',
        date: '',
        submit_place: '',
        other_notes: '',
        notice_cpv_type: '',
        price: '',
        eu_authority: '',
        attachments: {
          file: {
            name: '',
            content: '',
          },
        },
        info_places: '', // type ?
        basic_contract_sum_value: '',
        contract_amount: '',
        contract_price_from: '',
        contract_price_to: '',
        contract_currency: '',
        options: '',
        options_description: '',
        options_months: '',
        options_days: '',
        renewal_times: '',
        renewal_times_from: '',
        renewal_times_to: '',
        delivery_timetable_months: '',
        delivery_timetable_days: '',
        contract_months: '',
        contract_days: '',
        contract_start_date: '',
        contract_end_date: '',
        supplement_2: {
          region: '',
          basic_contract: '',
          currency: '',
          state_procurement: '',
        },
        supplement_2b: { // what kind of supplement types are there?
          place: '',
          region: '',
          service_types: '',
          basic_contract: '',
          description: '',
          price_exact: '',
          notes: '',
          price_from: '',
          price_to: '',
          currency: '',
          procedure_start_date: '',
          months: '',
          days: '',
          start_date: '',
          end_date: '',
          state_procurement: '',
        },
        supplement_3_4: {
          prof_qualification: '',
          prof_qual_text: '',
        },
        supplement_3: {
          guarantee: '',
          financial_rules: '',
          groups: '',
          other_conditions: '', // type?
          other_conditions_details: '',
          businessman_requirements: '',
          financial_requirements: '',
          financial_requirements_min: '',
          technical_requirements: '',
          technical_requirements_min: '',
          reserved: '',
        },
        procedure: {
          proc_type: '',
          argument: '',
          candidates_selected: '', // boolean
          count_restrictions: '', // type?
          tenderer_count_expected: '',
          criteria: '',
          tenderer_count_min: '',
          tenderer_count_max: '',
          tenderer_decrease: '',
          candidates: { // can this be an array?
            name: '',
            reg_nr: '',
            country: '',
            city: '',
            address: '',
          }
        },
        auction_description: '',
        variants: '', // type?
        administrative_info: {
          oj_digital: '', // boolean
          digital_access: '', // boolean
          previous_publications: '', // boolean
          previous_publications_oj: '', // boolean
          previous_publications_other: '', // boolean
          urgent: '', // boolean
          urgent_text: '',
          oj_list: '',
          publication_list: '',
          submit_date: '',
          submit_hour: '',
          submit_minute: '',
          send_date: '',
          submit_date_stamp: '',
          document_request_date: '',
          document_request_hour: '',
          document_request_minute: '',
          payment: '', // type?
          language: '',
          tender_open_date: '',
          tender_open_hour: '',
          tender_open_minute: '',
          tender_open_place: '',
          allowed: '', // type?
          allowed_persons: '',
        },
        submit_hour: '',
        submit_minute: '',
        cancel_user: '',
        first_approval_date: '',
        first_approval_date_stamp: '',
        new_scopes: {},
        middleman_list: {
          middleman_item: {
            auth_id: '',
            name: '',
            reg_num: '',
            address: '',
            city: '',
            zip_code: '',
            country: '', // country num ('1' for LV etc.)
          },
        },
        field_description: '',
        field_note: '',
        field_a: '',
        field_b: '',
        field_c: '',
        field_d: '',
        field_e: '',
        field_e1: '', // ????
        field_e2: '', // ????
        field_f: '',
        field_g: '',
        field_h: '',
        field_i: '',
        field_j: '',
        field_k: '',
        field_l: '',
        field_m: '',
        field_a_81: '',
        field_b_81: '',
        field_c_81: '',
        field_d_81: '',
        field_e_81: '',
        field_f_81: '',
        field_g_81: '',
        field_h_81: '',
        field_i_81: '',
        field_j_81: '',
        field_k_81: '',
        field_l_81: '',
        field_m_81: '',
        field_n_81: '',
        field_o_81: '',
        field_soc_a: '',
        field_soc_b: '',
        field_soc_c: '',
        field_soc_d: '',
        field_soc_e: '',
        field_soc_f: '',
        field_soc_g: '',
        timelimits: {
          dok_req_date: '',
          work_time: '',
          submit_hour: '',
          submit_minute: '',
          tender_open_date: '',
          tender_open_hour: '',
          tender_open_minute: '',
          tender_open_place: '',
          submit_date: '',
          submit_date_stamp: '',
        },
        submit_date_stamp: '',
        submit_date: '',
        tender_for_parts: '', // boolean
        info: '',
        end_date: '',
        start_date: '',
        days: '',
        months: '',
        language: '',
        middleman_search_name: {},
        documentation_online: '', // boolean ('0' or '1')
        submit_places: '', // boolean ('0' or '1')
        doc_places: '', // boolean ('0' or '1')
        id: '',
        content: '',
        service_type: {},
        extra_winners: '', // boolean ('0' or '1')
        extra_winners_reason: '',
        contract_expects: '',
        notes: '',
        environment_req_detail: '',
        no_doc_ext: '',
        send_oj: '',
        service_types: '',
        state_procurement: '',
        criteria_type: '',
        proc_type: '',
        update_date: '',
        update_date_stamp: '',
        publicate: '',
        price_from: '',
        price_to: '',
        with_vat: '',
        vat_rate: '',
        price_exact_lvl: '',
        building_types: '',
        supply_types: '',
        previous_publications: '',
        previous_publications_oj: '',
        previous_publications_other: '',
        auction: '',
        argument: {},
        criteria_list: {},
        oj_list: {},
        oj_digital: '',
        publication_list: {
          publication: {
            pub_date: '',
            pub_type: '',
          }
        },
        has_complaint: '',
        complaint_id: '',
        checker_id: '',
        checking_started: '',
      };

      function propNameFinder(obj, comparisonObj) {
        for (const prop in obj) {
          const val = obj[prop];

          if (comparisonObj[prop] === undefined) {
            console.log(`Property "${prop}" undefined:`, val);
          }

          // if (typeof val === 'object') {
          //
          // }
        }
      }

      propNameFinder(parsedData.document, properties);

      resolve(true);
      // if (!winner_list || !winner_list.winner) {
      //   if (
      //     parsedData.document.part_5_list &&
      //     parsedData.document.part_5_list.part_5 &&
      //     parsedData.document.part_5_list.part_5.winner_list &&
      //     parsedData.document.part_5_list.part_5.winner_list.winner
      //   ) {
      //     winner_list = {
      //       winner: parsedData.document.part_5_list.part_5.winner_list.winner
      //     };
      //   } else {
      //     console.log('no winner');
      //     return resolve(true);
      //   }
      // }
      //
      // const { winner } = winner_list;

      // IubEntry.findOneAndUpdate(
      //   { document_id: id._text },
      //   {
      //     document_id: id._text,
      //     authority_name: authority_name ? authority_name._text : null,
      //     authority_reg_num: authority_reg_num ? authority_reg_num._text: null,
      //     // main_cpv:  {
      //     //   lv: 'aaa',
      //     //   en: main_cpv.en || null,
      //     //   code_num: main_cpv.code_num || null,
      //     //   name: main_cpv.name || null,
      //     //   authority_name: main_cpv.authority_name || null,
      //     // },
      //     general: {
      //       // main_cpv: general.main_cpv ? {
      //         // lv: general.main_cpv.lv ? general.main_cpv.lv._text : null,
      //         // en: main_cpv.en ? main_cpv.en._text : null,
      //         // code_num: main_cpv.code_num ? main_cpv.code_num._text : null,
      //         // name: main_cpv.name ? main_cpv.name._text : null,
      //         // authority_name: main_cpv.authority_name ? main_cpv.authority_name._text : null,
      //         // contract_price_exact: main_cpv.contract_price_exact ? main_cpv.contract_price_exact._text : null,
      //         // approval_date: main_cpv.approval_date ? main_cpv.approval_date._text : null,
      //       // } : {},
      //     },
      //     part_5_list: {
      //       part_5: {
      //         decision_date: decision_date ? decision_date._text : null,
      //         contract_price_exact: contract_price_exact && !isNaN(parseFloat(contract_price_exact._text)) ? parseFloat(contract_price_exact._text) : null,
      //         exact_currency: exact_currency ? exact_currency._text : null,
      //         tender_num: tender_num ? tender_num._text : null,
      //         contract_name: contract_name ? contract_name._text : null,
      //         creation_date_stamp: creation_date_stamp ? creation_date_stamp._text : null,
      //       }
      //     },
      //     part_2: {
      //       price_exact: part_2.price_exact && !isNaN(parseFloat(part_2.price_exact._text)) ? parseFloat(part_2.price_exact._text) : null,
      //       price_exact_eur: part_2.price_exact_eur && !isNaN(parseFloat(part_2.price_exact_eur._text)) ? parseFloat(part_2.price_exact_eur._text) : null,
      //     },
      //     additional_info: {
      //       approval_date: approval_date ? approval_date._text : null,
      //       approval_date_stamp: approval_date_stamp ? approval_date_stamp._text : null,
      //       update_date: update_date ? update_date._text : null,
      //       update_date_stamp: update_date_stamp ? update_date_stamp._text : null,
      //
      //     },
      //     winner_list: {
      //       winner: {
      //         winner_name: winner.winner_name ? winner.winner_name._text : null,
      //         winner_reg_num: winner.winner_reg_num ? winner.winner_reg_num._text : null,
      //         winner_country: winner.winner_country ? winner.winner_country._text : null,
      //         price_exact_eur: winner.price_exact_eur && !isNaN(parseFloat(winner.price_exact_eur._text)) ? parseFloat(winner.price_exact_eur._text) : null,
      //         approval_date: winner.approval_date ? winner.approval_date._text : null,
      //         publication_date: winner.publication_date ? winner.publication_date._text : null,
      //       },
      //     },
      //     eu_fund: eu_fund === '0' ? false : eu_fund === '1' ? true : undefined,
      //     publication_date: publication_date ? publication_date._text : null,
      //     publication_date_stamp: publication_date_stamp ? publication_date_stamp._text : null,
      //   },
      //   {
      //     upsert: true, // insert if not found
      //   }
      // )
      // .then(() => resolve(true))
      // .catch(err => {
      //   console.log(err);
      //   reject(err);
      // });
    });
  });
}

/**
 * Extracts a specific .tar.gz file and saves the files to the database.
 * @param {Object} filePath - Path to the file which needs to be extracted.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function extractIUBFileData(filePath, ftpClient, year, month, day) {
  // Remove directory and extension for file name, so we can save it in a specific directory
  const fileName = filePath.replace(`${IUB.IUBLocalDataDirectory}/`, '').replace('.tar.gz', '');
  const fileDirectoryPath = `${IUB.IUBLocalDataDirectory}/${fileName}`;

  // Decompress IUB .tar.gz files to our server
  targz.decompress({
    src: filePath,
    dest: `${IUB.IUBLocalDataDirectory}/${fileName}`
  }, err => {
    if (err) throw err;

    // If there are no errors, we have successfully decompressed the files
    // First let's delete the .tar.gz file
    fs.unlinkSync(filePath);

    // Now let's read files in the extracted directory
    fs.readdir(fileDirectoryPath, (err, files) => {
      if (err) throw err;

      // Create promise array for the file parsing
      const IUBFileParsingPromises = [];

      // Go through each of the files
      files.forEach(file => {
        // Add each file to promise
        IUBFileParsingPromises.push(parseIUBXmlToJson(`${fileDirectoryPath}/${file}`));
      });

      // Wait for all files are parsed
      return Promise.all(IUBFileParsingPromises)
        .then(() => {
          // After all files are parsed, make sure that we delete directory with files
          fse.remove(`${IUB.IUBLocalDataDirectory}/${fileName}`, err => {
            if (err) throw err;

            return callNextIteration(ftpClient, year, month, day);
          });
        })
        .catch(err => {
          throw err
        });
    });
  });
}

function callNextIteration(ftpClient, year, month, day) {
  const fetchedDate = new Date();

  fetchedDate.setFullYear(year);
  fetchedDate.setMonth(parseInt(month) - 1);
  fetchedDate.setDate(day);

  if (helpers.isToday(fetchedDate)) {
    // Close FTP connection

    return ftpClient.end();
  } else {
    const nextDay = new Date();

    nextDay.setFullYear(year);
    nextDay.setMonth(parseInt(month) - 1);
    nextDay.setDate(fetchedDate.getDate() + 1);

    const nextDayMonth = nextDay.getMonth() + 1;
    const nextDayDate = nextDay.getDate();
    const nextDayParsedDate = nextDayDate < 10 ? `0${nextDayDate}` : nextDayDate.toString();
    const nextDayParsedMonth = nextDayMonth < 10 ? `0${nextDayMonth}` : nextDayMonth.toString();
    const nextDayYear = nextDay.getFullYear().toString();

    ftpClient.end();

    return fetchIUBData(nextDayYear, nextDayParsedMonth, nextDayParsedDate);
  }
}
/**
 * Downloads a specific file from the IUB Database.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {Object} fileToFetch - Object of the current file that needs to be fetched.
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function downloadIUBData(ftpClient, fileToFetch, year, month, day) {
  // Get file stream from IUB FTP server
  ftpClient.get(fileToFetch.name, (err, stream) => {
    if (err) throw err;

    // When ZIP file is saved, make sure to extract and save data
    stream.once('close', () => {
      // Close FTP connection
      ftpClient.end();

      // Extract IUB File
      extractIUBFileData(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`, ftpClient, year, month, day);
    });

    // Save the file to local system
    stream.pipe(fs.createWriteStream(`${IUB.IUBLocalDataDirectory}/${fileToFetch.name}`));
  });
}

/**
 * Reads IUB FTP structure.
 * @param {Object} ftpClient - FTP Client instance for the IUB FTP server.
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function readIUBFtpStructure(ftpClient, year, month, day) {
  // List all initial files/directories of IUB FTP
  ftpClient.list((err, rootList) => {
    if (err) throw err;

    // Find the year directories and exclude any files.
    const directoryTypeName = 'd';
    const fetchYearDirectoryName = rootList.find(item => item.type === directoryTypeName && item.name === year).name;

    // Retrieve current directory
    ftpClient.pwd((err, currentDir) => {
      if (err) throw err;

      const yearDirectoryPath = `${currentDir}/${fetchYearDirectoryName}`;

      // Navigate inside the year directory
      ftpClient.cwd(yearDirectoryPath, err => {
        if (err) throw err;

        // List files in the year directory
        ftpClient.list((err, monthList) => {
          if (err) throw err;

          // Filter out only month directories and exclude any files
          const fetchMonthDirectoryName = monthList.find(item => item.type === 'd' && item.name == `${month}_${year}`).name;
          const monthDirectoryName = `${currentDir}/${fetchYearDirectoryName}/${fetchMonthDirectoryName}`;

          // Navigate inside the month directory
          ftpClient.cwd(monthDirectoryName, err => {
            if (err) throw err;

            // List the files in month directory
            ftpClient.list((err, fileList) => {
              if (err) throw err;

              // Filter out only tar.gz files
              let fileToFetch = fileList.find(item => item.name.indexOf('.tar.gz') !== -1 && item.name === `${day}_${month}_${year}.tar.gz`);

              if (fileToFetch) {
                // Download the file and extract the data
                downloadIUBData(ftpClient, fileToFetch, year, month, day);
              } else {
                callNextIteration(ftpClient, year, month, day);
              }
            });
          });
        });
      });
    });
  });
}

/**
 * Initializes a new FTP client instance and initiates fetching on ready.
 *
 * @param {string} year Year string (e.g. '2014')
 * @param {string} month Month string (e.g. '01')
 * @param {string} day Date string (e.g. '31')
 */
function fetchIUBData(year, month, day) {
  // Initialize ftp client
  const ftpClient = new ftpClientInstance();

  // Retrieve directory list
  ftpClient.on('ready', () => {
    console.log(`Fetching: ${year}/${month}/${day}`);
    readIUBFtpStructure(ftpClient, year, month, day);
  });

  // Connect to the IUB FTP
  ftpClient.connect({
    host: IUB.ftpHostname
  });
}

/**
 * Modules that are exported from the controller.
 */
module.exports = {
  /**
   * Fetches data from the IUB data.
   */
  fetchIUBData
};
