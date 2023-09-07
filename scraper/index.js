const slugify = require('slugify')
const sharp = require('sharp')
const moment = require('moment') // Install this via npm install moment
const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs-extra')
const path = require('path')

/* Store the images here: */
const stories = []

const baseURL = 'https://www.thenewhumanitarian.org'
const allArticlesURL = baseURL + '/all-articles'
const outputFolder = 'downloaded_images'
const targetStoryCount = 100
let currentStoryCount = 0

async function createThumbnail(imagePath) {
	const thumbnailPath = path.join(path.dirname(imagePath), 'thumbnails', path.basename(imagePath))

	await sharp(imagePath)
		.resize(200, 200, {
			// Thumbnail size
			fit: sharp.fit.cover, // Crop to cover both provided dimensions
			position: sharp.strategy.entropy, // Focus on the region with the highest entropy
		})
		.toFile(thumbnailPath)

	return thumbnailPath
}

async function downloadStory(url, filename, title, subheading, index) {
	const response = await axios({
		method: 'GET',
		url: url,
		responseType: 'stream',
	})

	const outputPath = path.resolve(__dirname, outputFolder, filename)
	const writer = fs.createWriteStream(outputPath)

	response.data.pipe(writer)

	await new Promise((resolve, reject) => {
		writer.on('finish', resolve)
		writer.on('error', reject)
	})

	// Add image details to our tracking array
	stories.push({
		id: index,
		title: title,
		subheading: subheading,
		slug: slugify(title),
		image: {
			url: url,
			fileName: filename,
		},
	})

	try {
		await createThumbnail(outputPath)
	} catch (err) {
		console.error(`Failed to create thumbnail for ${filename}. Error: ${err.message}`)
	}
}

function getFullURL(link) {
	console.log(link)

	if (link.startsWith('http') || link.startsWith('https')) {
		return link
	} else {
		return baseURL + link
	}
}

async function scrapeArticlesFromPage(url, pageNumber = 0) {
	if (currentStoryCount >= targetStoryCount) return

	const response = await axios.get(url)
	const $ = cheerio.load(response.data)

	const articleLinks = []
	$('li.teaser-list__item a').each((index, element) => {
		articleLinks.push($(element).attr('href'))
	})

	for (let link of articleLinks) {
		if (!link) continue

		const fullURL = getFullURL(link)

		if (fullURL.includes('https://www.thenewhumanitarian.org/film/')) {
			continue
		}

		const articleResponse = await axios.get(fullURL)
		const $$ = cheerio.load(articleResponse.data)

		const mainImageElement = $$('.article__banner img').first()

		if (mainImageElement.length) {
			const imageUrl = mainImageElement.attr('src')
			const isValidImage = /\.(jpg|jpeg|png)(\?.+)?$/i.test(imageUrl)
			if (!isValidImage) continue

			const imageFileName = imageUrl.split('/').pop().split('?')[0]
			const cleanedImageName = slugify(imageFileName)

			const title = $$('.article__title').text().trim().normalize('NFC')
			const subheading = $$('.article__subheading').text().trim().normalize('NFC')

			await downloadStory(imageUrl, cleanedImageName, title, subheading, currentStoryCount)
			currentStoryCount++
		}

		if (currentStoryCount >= targetStoryCount) return
	}

	// Increment page number and recurse
	const nextPageNumber = pageNumber + 1
	const nextPageURL = `${baseURL}/all-articles?page=${nextPageNumber}`
	await scrapeArticlesFromPage(nextPageURL, nextPageNumber)
}

// Ensure the images directory exists
fs.ensureDirSync(outputFolder)
fs.ensureDirSync(path.join(outputFolder, 'thumbnails'))

// Start the scraping process
scrapeArticlesFromPage(allArticlesURL)
	.then(() => {
		// Write the image details to a new JSON file with a timestamped name in the main directory
		const timestamp = moment().format('YYYYMMDD_HHmmss')
		fs.writeJsonSync(path.join(__dirname, `stories_${timestamp}.json`), stories)
	})
	.catch(console.error)
