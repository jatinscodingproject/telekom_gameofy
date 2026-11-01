const config = require("../config/env");
const svc = require("../services/subscriptionService");
const session = require("../utils/session");
const { isEntitled } = require("../services/subscriptionState");
const { msisdnFromHeaders } = require("../utils/msisdn");

exports.homePage = async (req, res) => {
    try {
        // Network-injected MSISDN (header enrichment). Header names are configurable via MSISDN_HEADERS.
        // To discover the real header name on Telkom mobile data, set LOG_HEADERS=true once and read the log.
        if (process.env.LOG_HEADERS === "true") console.log("headers", req.headers);

        const sess = session.getSession(req);
        let subscribed = false;
        if (sess && sess.msisdn) {
            const row = await svc.latestForMsisdn(sess.msisdn);   // always re-check DB: cancelled/expired users lose access
            subscribed = !!row && isEntitled(row.status, config.entitledStatuses);
            if (!subscribed) session.clearSession(res);
        }

        return res.render("pages/index", {
            title: "Home Page",
            subscribed,
            msisdn: msisdnFromHeaders(req.headers) || "",
            supportContact: config.supportContact,
            cancelInstructions: config.cancelInstructions
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).render("pages/error", { message: "Something went wrong!" });
    }
};

exports.termsPage = async (req, res) => {
    try {
        return res.render("pages/term", { title: "Terms And Condition Page" });
    } catch (error) {
        console.error(error.message);
        return res.status(500).render("pages/error", { message: "Something went wrong!" });
    }
};
