Ali Jameel
November 5, 2023
COMP 4601 Assignment 1

Compilation Instructions:
    - Open two terminals in this directory:
    - In the first terminal
        - Enter "mongod --dbpath=databse"
    - In the second terminal    
        - Enter 'npm install'
        - Enter 'npm start'

Video Link: 


1. How does your crawler work? What information does it extract from the page? How does it store the data? Is there any intermediary processing you perform to facilitate the later steps of the assignment?
2. Discuss the RESTful design of your server. How has your implementation incorporated the various REST principles?
3. Explain how the content score for the search is generated.
4. Discuss the PageRank calculation and how you have implemented it.
5. How have you defined your page selection policy for your crawler for your personal site?
6. Why did you select the personal site you chose? Did you run into any problems when
working with this site? How did you address these problems?
7. Critique your search engine. How well does it work? How well will it scale? How do you
think it could be improved?


Lab Discussion Questions:
    1. The crawlers work by queing them to the initial pages once the database is connected. It's done then to ensure we are able to store the data we 
    extract. I first exctarct all href's as these are the pages that the current page lists, I also store the page content by searching for <p tags, as this
    is where most of the text on the websites are. The pages schema has 2 objects. One to store information on the page, and one to track where the page is refferenced.
    This is because we may not have "crawled" a page that we see linked on another page, so this allows me to store that its refferenced on another page, while not having to had
    crawled the page yet. For the goverment site, it is much more structed, each page is only linked once, and therefore every page has an equal PageRank which requires me to not
    have to track refferences.

    2. I implemented RESTful server design through use of Express. I used it to handle GET request for all my endpoinds. And each endpoint
    querries the request and database if necessary and returns JSON or rendered HTML through using the pug engine.

    3. The content score for each search is generated in a pretty simple way. The maximum score a result can have is the number of words in the search + its page rank value.
    This is because I track how many pages have each possible number of matching words in its content. For example; if you search "Hi there" there can be pages with "hi", pages 
    with "there", and pages with both. So there are 3 possibilities. For every matching word a page contains, I give it one point. If boost = true, then we want to include the PageRank
    score which can be at MAXIMUM 1 (extremley rare), the max possible score a page can have for the search "hi there" is 2.02 since in my case the highest page rank value is 0.02...
    If boost is not true, I just use whichever page is linked more frequently, which in the case on the fruits, i store the pagelinks, and for the countries (personal), they are all linked once.

    4. PageRank calculation was pretty straight forward in terms of following instructions from the lecture. Here was my pseudo code before typing it out:

            COMP 4061 Week 7, lecture: Page Rank

            Step 1: Create “basic” adjacency matrix.
            - N X N matrix, where N is the number of pages
            - If the page at oneOfTheArrays[I] links to oneOfTheArrays[j] then matrix[I,j] = 1, else 0

            Step 2: For rows that have no 1’s, replace each 0 with 1/N

            Step 3: For rows that do have 2’s, replace each one with 1/numberOfOnesInThatRow

            Step 4: Multiply the resulting matrix by (1 - alpha)

            Step 5: Add a alpha/N to each entry of the resulting matrix

            Step 1 brainstorm: 
            - Loop through each page captured
            - For each page, create its initial adjacency matrix row.
                - Meaning, check which pages this page links, add 1’s
                - Find which pages this page does link and add 0’s
                - Need to find a way how to Store the matrix’s rows in a consistent order
                    - Resolution: Loop through the pages id 0-1000, since we know there are 1000 pageId's. This way we can have the same X and Y axis.
            
    5. The selection policy for the countries list is pretty simple. I just wanted to go to every country that was listed as a href on the inital page.

    6. I initally was going to use basketball-refference to store a bunch of player data to be able to search for stats and players with the closest stats would
    appear. The issue was that the crawler didn't work well on that site. I've tried using another crawler on that site before as well and it wasn't working then either.
    I think they have a very low rate limit. Here is some code I had for that, which had a much more complex selection policy:

            let isPlayer = false;
            let isSeason = false;

            if (pageUrl.includes("players")){
                isPlayer = true;
            }

            if (pageUrl.includes("teams") && pageUrl !== "https://www.basketball-reference.com/teams/TOR/"){
                isSeason = true;
            }
            
            // Loop through https://www.basketball-reference.com/teams/TOR/ and que every raptors seasons
            // if (!isPlayer && !isSeason){
                let hrefValues = [];
                $("th a").each(function (i, link) {
                    // console.log("LOOKING FOR HREFS")
                    let href = $(link).attr("href");
                    if (href) {
                        hrefValues.push(href);
                        // console.log(basketballRefUrl+href)
                        c2.queue(basketballRefUrl+href);
                    }
                });
            // }

            // Loop through the season and que each player from each season
            if (isSeason){
                let hrefValues = [];
                $("td a").each(function (i, link) {
                    // console.log("LOOKING FOR HREFS")
                    let href = $(link).attr("href");
                    if (href.includes("html")) {
                        hrefValues.push(href);
                        // console.log(basketballRefUrl+href)
                        c2.queue(basketballRefUrl+href);
                    }
                });
            }
    
    I decided to go with a country linking system as I anticipated there to be more interconnection in a history section of the page 
    but there were no hrefs to other countries on any of the pages.

    7. I think there were 2 factors I wanted to account for that I didn't get the time for, 
    - first: if it is a multi word search and multiple pages have all the words, track the distance between the words from each other.
    - second: track how many times a word is used in a single word search.