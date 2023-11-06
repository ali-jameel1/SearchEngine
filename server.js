const { Matrix } = require('ml-matrix')

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost:27017/database', { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());


const pageSchema = new Schema({
    id: Number,
    url: String,
    content: String,
    links: [Number],
});

const pageLinkSchema = new Schema({
    id: Number,
    linkedBy: [Number]
});

const Page = mongoose.model('Page', pageSchema);
const PageLink = mongoose.model('PageLink', pageLinkSchema);

const countrySchema = new Schema({
    id: Number,
    name: String,
    url: String,
    content: String, 
});

const Country = mongoose.model('Country', countrySchema);

const Crawler = require("crawler");

const url = "https://people.scs.carleton.ca/~davidmckenney/fruitgraph/"
const govCountriesUrl = "https://history.state.gov"
const myQueue = [url+"N-0.html"];

let queueSet = new Set();

queueSet.add("N-0.html");

const c = new Crawler({
    maxConnections : 1000,

    callback : async function (error, res, done) {
        if(error){
            // console.log(error);
        }else{
            let $ = res.$;
            let links = $("a")
            let realLinks = [];
            $(links).each(function(i, link){
              realLinks.push($(link).attr('href'));
            });

            const body = $("p").text().toString();

            let pageUrl = res.request.uri.href;
            let pageIdMatch = pageUrl.match(/N-(\d+)\.html/); 
            let pageId = pageIdMatch ? pageIdMatch[1] : null;

            let linkedIds = [];

            for (let link of realLinks) {
                let linkedMatch = link.match(/N-(\d+)\.html/); 
                let linkedId = linkedMatch ? linkedMatch[1] : null;
                linkedIds.push(linkedId);
                let pageLinkDocument = await PageLink.findOne({ id: linkedId });
                if (!pageLinkDocument) {
                    let newPageLink = new PageLink({
                        id: linkedId,
                        linkedBy: [pageId]
                    });
                    await newPageLink.save();
                } else {
                    pageLinkDocument.linkedBy.push(pageId);
                    await pageLinkDocument.save();
                }
                if (!queueSet.has(link)){
                    queueSet.add(link);
                    c.queue(url + link.substring(2));
                }                
            }

            let newPage = Page({
                id: pageId,
                url: pageUrl,
                content: body,
                links: linkedIds,
            })

            newPage.save()
        }
        done();
    }
});

let visited = 0;

let queueSet2 = new Set();

//Starting URL
queueSet2.add("/countries/all");

//Ignore these URL's
queueSet2.add("/countries/archives");
queueSet2.add("/countries/archives/all");
queueSet2.add("/countries/issues");

let countryId = 0;

const c2 = new Crawler({
    maxConnections: 1000,
    callback: async function (error, res, done) {
        if (error) {
            // Handle error
        } else {
            let $ = res.$;
            let links = $("a")
            let realLinks = [];
            const body = $("p").text().toString();
            $(links).each(function(i, link){
                let href = $(link).attr('href')
                if (href.includes("/countries/")){
                    if (!queueSet.has(href)){
                        realLinks.push(href);
                        queueSet.add(href);
                        c2.queue(govCountriesUrl + href);
                    }
                }        
              });

            // console.log(realLinks)

            let pageUrl = res.request.uri.href;
            const parts = pageUrl.split('/');
            const name = parts[parts.length - 1];

            if (!pageUrl.includes("/all")){
                let newCountry = Country({
                    id: countryId++,
                    name: name,
                    url: pageUrl,
                    content: body,
                })

                newCountry.save()
            }

        }
        done();
    }
});

app.get('/popular', async (req, res) => {
    try {
        const popularPages = await PageLink.aggregate([
            { $project: { _id: 0, id: 1, numberOfLinks: { $size: "$linkedBy" } } },
            { $sort: { numberOfLinks: -1 } },
            { $limit: 10 }
        ]);

        const popularPageIds = popularPages.map(page => page.id);

        const pages = await Page.find({ id: { $in: popularPageIds } });

        res.render('popular', { pages: pages });

    } catch (err) {
        res.status(500).send("Internal Server Error");
    }
});


app.get("/page/:pageId", async (req, res) => {
    try {
        const pageLinks = await PageLink.findOne({id: req.params.pageId });
        const page = await Page.findOne({id: req.params.pageId})
        res.render('page', { 
            page: {
                pageHeader: req.params.pageId,
                pageContents: page.content,
                pageInLinks: pageLinks.linkedBy,
                pageOutLinks: page.links,
            }
        });
    } catch (err) {
        res.status(500).send("Internal Server Error");
    }
});

app.get("/perspage/:pageId", async (req, res) => {
    try {
        const country = await Country.findOne({id: req.params.pageId });
        // const page = await Page.findOne({id: req.params.pageId})
        res.render('page', { 
            page: {
                pageHeader: req.params.pageId,
                pageContents: country.content,
                pageInLinks: country.linkedBy,
                pageOutLinks: country.links,
            }
        });
    } catch (err) {
        res.status(500).send("Internal Server Error");
    }
});

app.get("/matrix", (req, res) => {
    createFruitMatrix();
})

app.get("/fruits", async (req, res) => {
    try {
        const matrixResults = await createFruitMatrix();
        const { q, boost, limit = 10 } = req.query;

        if (limit > 50 || limit < 0) {
            res.status(400).send("You must provide a limit between 1 and 50.");
            return;
        }

        let searchResult = [];
        let words = [];

        if (q) {
            if (q.includes("+")) {
                words = q.split("+");
            } else {
                words = [q];
            }
        }

        const matchingPagesByCount = {};

        for (let x = 0; x < 1000; x++) {
            const page = await Page.findOne({ id: x });
            if (page) {
                const content = page.content.toLowerCase();
                const missingWords = words.filter(word => !content.includes(word.toLowerCase()));
                const matchingWordsCount = words.length - missingWords.length;

                if (!matchingPagesByCount[matchingWordsCount]) {
                    matchingPagesByCount[matchingWordsCount] = [];
                }
                matchingPagesByCount[matchingWordsCount].push(page);
            }
        }

        const sortedMatchingKeys = Object.keys(matchingPagesByCount).map(Number).sort((a, b) => b - a);

        let rank = 1;

        for (const key of sortedMatchingKeys) {
            const pagesForKey = matchingPagesByCount[key];
            for (const page of pagesForKey) {
                let searchScore = key;

                const matrixPage = matrixResults.find(result => result.id === page.id);
                if (boost && matrixPage) {
                    searchScore += matrixPage.pagerank;
                }

                searchResult.push({
                    name: "Ali Jameel",
                    url: page.url,
                    score: searchScore,
                    title: "N-"+page.id+".html",
                    pr: rank,
                    id: page.id
                });
            }
        }

        searchResult.sort((a, b) => b.score - a.score);

        searchResult.forEach((result, index) => {
            result.pr = rank++;
        });


        if (req.isJSONRequest) {
            res.json(searchResult.slice(0, limit));
        } else {
            res.render('fruits', { finalSearch: searchResult.slice(0, limit) });
        }
    } catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/personal", async (req, res) => {
    try {
        const { q, boost, limit = 10 } = req.query;

        if (limit > 50 || limit < 0) {
            res.status(400).send("You must provide a limit between 1 and 50.");
            return;
        }

        let searchResult = [];
        let words = [];

        if (q) {
            if (q.includes("+")) {
                words = q.split("+");
            } else {
                words = [q];
            }
        }

        const matchingPagesByCount = {};
        const countryCount = await Country.find().count();
        for (let x = 0; x < countryCount; x++) {
            const page = await Country.findOne({ id: x });
            if (page) {
                const content = page.content.toLowerCase();
                const missingWords = words.filter(word => !content.includes(word.toLowerCase()));
                const matchingWordsCount = words.length - missingWords.length;

                if (!matchingPagesByCount[matchingWordsCount]) {
                    matchingPagesByCount[matchingWordsCount] = [];
                }
                matchingPagesByCount[matchingWordsCount].push(page);
            }
        }

        const sortedMatchingKeys = Object.keys(matchingPagesByCount).map(Number).sort((a, b) => b - a);

        let rank = 1;

        for (const key of sortedMatchingKeys) {
            const countriesForKey = matchingPagesByCount[key];
            for (const country of countriesForKey) {
                let searchScore = key;

                if (boost) {
                    searchScore += 1/countryCount;
                }

                searchResult.push({
                    name: "Ali Jameel",
                    url: country.url,
                    score: searchScore,
                    title: country.name+".html",
                    pr: rank,
                    id: country.id
                });
            }
        }

        searchResult.sort((a, b) => b.score - a.score);

        searchResult.forEach((result, index) => {
            result.pr = rank++;
        });


        if (req.isJSONRequest) {
            res.json(searchResult.slice(0, limit));
        } else {
            res.render('personal', { finalSearch: searchResult.slice(0, limit) });
        }
    } catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }
});

async function createFruitMatrix() {
    let matrixArray = [];
    let alpha = 0.1;
    let pageRankValues = [];

    for (let i = 0; i < 1000; i++) {
        let initialRow = [];
        let matrixPage = await Page.findOne({ id: i });
        for (let x = 0; x < 1000; x++) {
            initialRow.push(matrixPage.links.includes(x) ? 1 : 0);
        }
        const numOnes = matrixPage.links.length;
        let matrixRow = [];
        if (numOnes > 0) {
            for (let value of initialRow) {
                if (value === 1) {
                    matrixRow.push(1 / numOnes);
                } else {
                    matrixRow.push(0);
                }
            }
        } else {
            for (let x = 0; x < 1000; x++) {
                matrixRow.push(1 / 1000);
            }
        }
        matrixArray.push(matrixRow);

        pageRankValues.push({
            id: matrixPage.id,
            pagerank: 0,
        });
    }

    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 1000; j++) {
            matrixArray[i][j] *= (1 - alpha);
        }
    }

    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 1000; j++) {
            matrixArray[i][j] += alpha / 1000;
        }
    }

    let matrix = new Matrix(matrixArray);

    let x0Arr = [1];

    for (let i = 0; i < 999; i++) {
        x0Arr.push(0);
    }

    let x0 = new Matrix([x0Arr]);

    for (let i = 0; i < 50; i++) {
        x0 = x0.mmul(matrix);
    }

    let valuesArray = x0.data[0];
    let pageRankArr = [];
    for (let i = 0; i < 1000; i++) {
        pageRankArr.push(valuesArray[i]);
    }

    for (let i = 0; i < pageRankArr.length; i++) {
        pageRankValues[i].pagerank = pageRankArr[i];
    }

    return pageRankValues;
}



db.once('open', function() {
    c.queue(myQueue);
    
    c.on('drain', function() {
        console.log("Done.");
        createFruitMatrix();
    });
    
    c2.queue(govCountriesUrl +  "/countries/all");
    
    c2.on('drain', function() {
        console.log("Done.");
    });
})

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

const serverURL = 'http://134.117.131.162:3000';

try {
    const response = await axios.put('http://134.117.130.17:3000/searchengines', {
      request_url: serverURL
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Status Code:', response.status);
    console.log('Body:', response.data);
  } catch (error) {
    // console.log(error)
}