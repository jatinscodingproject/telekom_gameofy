const axios = require("axios");

exports.homePage = async (req, res) => {
    try {
        return res.render("pages/index", {
            title: "Home Page",
        }); 
    } catch (error) {
        console.error(error.message);

        return res.status(500).render("pages/error", {
            message: "Something went wrong!",
        });
    }
};

exports.termsPage = async (req, res) => {
    try {
        return res.render("pages/term", {
            title: "Terms And Condition Page",
        }); 
    } catch (error) {
        console.error(error.message);

        return res.status(500).render("pages/error", {
            message: "Something went wrong!",
        });
    }
};