import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {encode} from 'blurhash';
import sharp, {Sharp} from 'sharp';
import {config} from 'dotenv';
config();

import {Question} from './updateImagesInJSON';
// load the config for s3
const s3 = new S3Client({region: process.env.REGION});

const encodeImageToBlurhash = (sharpImg: Sharp): Promise<string> =>
  new Promise((resolve, reject) => {
    sharpImg
      .raw()
      .ensureAlpha()
      .resize(32, null, {fit: 'inside'})
      .toBuffer((err, buffer, {width, height}) => {
        if (err) return reject(err);
        resolve(encode(new Uint8ClampedArray(buffer), width, height, 4, 4));
      });
  });

interface Props {
  question: Question;
  imgPath: string;
}
// generate img function
const generateImg = async ({question, imgPath}: Props): Promise<Question> => {
  const sharpImg = sharp(`${imgPath}/${question.image}`);

  const {width, height} = await sharpImg.metadata();

  // don't proceed if no height or width
  if (!width || !height) {
    throw Error('Couldnt get width or height');
  }
  const hash = await encodeImageToBlurhash(sharpImg);
  question.blurhash = hash;
  // set the aspect ration
  question.aspect_ratio = +(width / height).toFixed(3);

  const webpPath = `question-images/${question.image.slice(0, -3)}webp`;

  const webp = await sharp(`${imgPath}/${question.image}`)
    .resize(400, null, {fit: 'contain'})
    .webp()
    .toBuffer();

  const command = new PutObjectCommand({
    Body: webp,
    Key: webpPath,
    Bucket: 'introvert-test-assets',
  });

  await s3.send(command);

  question.image = webpPath;

  return question;
};

export default generateImg;
