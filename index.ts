import sync from 'fast-glob';
import {config} from 'dotenv';

import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {join} from 'path';
import {cwd} from 'process';
import {readFileSync, writeFileSync} from 'fs';

import Piscina from 'piscina';

export interface Question {
  id: number;
  image: string;
  blurhash: string;
  aspect_ratio: number;
  question: string;
  options: {
    text: string;
    points: number;
  };
}

config();

const questionsJSON = readFileSync('../questions.json').toString();

const questions: Question[] = JSON.parse(questionsJSON);

const s3 = new S3Client({region: process.env.REGION});

const imgPath = join(cwd(), '../question-images');
const imgList = await sync('*.jpg', {cwd: imgPath});

// fill up image with image paths
imgList.forEach(rawPath => {
  const path = rawPath.slice(0, -4);
  const id: string | undefined = path.split('_')[1];

  // if there is no id stop it
  if (!id) return;

  questions[+id].image = rawPath;
});

const worker = new Piscina({
  filename: './worker.js',
});

const res = await Promise.all(
  questions.map(question => worker.run({question, imgPath})),
);

const json = JSON.stringify(res);

writeFileSync('../questions.json', json);

await s3.send(
  new PutObjectCommand({
    Bucket: 'introvert-test-assets',
    Body: json,
    Key: 'questions.json',
  }),
);

console.log('all done check s3');
