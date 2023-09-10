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
const targetStoryCount = 200
let currentStoryCount = 0
const thumbnailSize = 200
const thumbnailOutputFolder = 'thumbnails'
const placeholderSize = 10
const placeholderOutputFolder = 'placeholders'

const exampleBodyString = `<h2>HTML Ipsum Presents</h2><p><strong>Pellentesque habitant morbi tristique</strong> senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper. <em>Aenean ultricies mi vitae est.</em> Mauris placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum erat wisi, condimentum sed, <code>commodo vitae</code>, ornare sit amet, wisi. Aenean fermentum, elit eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui. <a href="#">Donec non enim</a> in turpis pulvinar facilisis. Ut felis.</p><h2>Header Level 2</h2><ol><li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.</li><li>Aliquam tincidunt mauris eu risus.</li></ol><blockquote><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus magna. Cras in mi at felis aliquet congue. Ut a est eget ligula molestie gravida. Curabitur massa. Donec eleifend, libero at sagittis mollis, tellus est malesuada tellus, at luctus turpis elit sit amet quam. Vivamus pretium ornare est.</p></blockquote><h3>Header Level 3</h3><ul><li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.</li><li>Aliquam tincidunt mauris eu risus.</li></ul><pre><code>#header h1 a {display: block;width: 300px;height: 80px;}</code></pre>`

async function createThumbnail(imagePath) {
	const thumbnailPath = path.join(path.dirname(imagePath), thumbnailOutputFolder, path.basename(imagePath))

	await sharp(imagePath)
		.resize(thumbnailSize, thumbnailSize, {
			// Thumbnail size
			fit: sharp.fit.cover, // Crop to cover both provided dimensions
			position: sharp.strategy.entropy, // Focus on the region with the highest entropy
		})
		.toFile(thumbnailPath)

	return thumbnailPath
}

async function createPlaceholder(imagePath) {
	const placeholderPath = path.join(path.dirname(imagePath), placeholderOutputFolder, path.basename(imagePath))

	await sharp(imagePath)
		.resize(placeholderSize, placeholderSize, {
			fit: sharp.fit.cover,
			position: sharp.strategy.entropy,
		})
		.toFile(placeholderPath)

	return placeholderPath
}

async function downloadStory(imageUrl, filename, title, subheading, index) {
	const response = await axios({
		method: 'GET',
		url: imageUrl,
		responseType: 'stream',
	})

	const outputPath = path.resolve(__dirname, outputFolder, filename)
	const writer = fs.createWriteStream(outputPath)

	response.data.pipe(writer)

	await new Promise((resolve, reject) => {
		writer.on('finish', resolve)
		writer.on('error', reject)
	})

	// Use sharp to obtain image dimensions
	const imageMetadata = await sharp(outputPath).metadata()

	// Create placeholder and thumbnail versions of the image
	try {
		await createThumbnail(outputPath)
	} catch (err) {
		console.error(`Failed to create thumbnail for ${filename}. Error: ${err.message}`)
	}

	try {
		await createPlaceholder(outputPath)
	} catch (err) {
		console.error(`Failed to create placeholder for ${filename}. Error: ${err.message}`)
	}

	// Add image details to our tracking array
	stories.push({
		id: index,
		title: title,
		subheading: subheading,
		body: exampleBodyString,
		slug: slugify(title),
		lastRead: null,
		image: {
			url: imageUrl,
			fileName: filename,
			width: imageMetadata.width, // Set width from sharp metadata
			height: imageMetadata.height, // Set height from sharp metadata
			placeholder: {
				url: `/${outputFolder}/${placeholderOutputFolder}/${filename}`,
				fileName: filename,
				width: placeholderSize,
				height: placeholderSize,
			},
			thumbnail: {
				url: `/${outputFolder}/${thumbnailOutputFolder}/${filename}`,
				fileName: filename,
				width: thumbnailSize,
				height: thumbnailSize,
			},
		},
	})
}

function getFullURL(link) {
	console.log(`🏞️ Current image URL: ${link}`)

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

			console.log(`✨ Loading story ${currentStoryCount + 1} of ${targetStoryCount}`)

			await downloadStory(imageUrl, cleanedImageName, title, subheading, currentStoryCount)
			currentStoryCount++
		}

		if (currentStoryCount >= targetStoryCount) {
			console.log('👏 All done!')
			return
		}
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
