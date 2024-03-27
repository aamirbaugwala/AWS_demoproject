// FileUpload.js
import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import AWS from 'aws-sdk';
import useSWR from 'swr';
import './FileUpload.css'; // Import CSS file


require('dotenv').config();

const S3_BUCKET = process.env.S3_BUCKET;
const INPUT_BUCKET = process.env.INPUT_BUCKET;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;
const REGION = process.env.REGION;
const PROCESSED_FILENAME = process.env.PROCESSED_FILENAME;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: REGION,
});

const FileUpload = () => {
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [preprocessedData, setPreprocessedData] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);

    const onDrop = async (acceptedFiles) => {
      const file = acceptedFiles[0];
      setUploading(true);
      setProgress(0);
  
      try {
        // Upload file to S3 bucket
        const uploadParams = {
          Bucket: `${S3_BUCKET}/${INPUT_BUCKET}`,
          Key: file.name,
          Body: file,
          ACL: 'public-read',
        };
  
        const options = { partSize: 5 * 1024 * 1024, queueSize: 1 };
  
        const response = await s3
          .upload(uploadParams, options)
          .on('httpUploadProgress', (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          })
          .promise();
  
        // Check if the upload was successful
        if (response && response.Location) {
          setUploadedFile(file);
          setUploadSuccess(true);
          pollPreprocessedFile(PROCESSED_FILENAME);
          console.log('File uploaded successfully!!');
        } else {
          setUploadSuccess(false);
        }
      } catch (error) {
        console.error('Error uploading file: ', error);
        setUploadSuccess(false);
        setError('Error uploading file');
      } finally {
        setUploading(false);
      }
    };
  
    const pollPreprocessedFile = (fileName) => {
      const intervalId = setInterval(async () => {
        try {
          const params = {
            Bucket: `${S3_BUCKET}/${OUTPUT_BUCKET}`,
            Key: fileName,
          };
          const response = await s3.getObject(params).promise();
  
          // If file exists, stop polling and set it
          if (response.Body) {
            clearInterval(intervalId);
            const data = JSON.parse(response.Body.toString('utf-8'));
            setPreprocessedData(data);
            setUploading(false);
          }
        } catch (error) {
          console.error('Error polling preprocessed file: ', error);
          clearInterval(intervalId);
          setError('Error polling preprocessed file');
          setUploading(false);
        }
      }, 35000); // Poll every 30 seconds
    };
  
    const { getRootProps, getInputProps } = useDropzone({ onDrop });
  
    return (
      <div className="file-upload-container">
        <div {...getRootProps()} className="dropzone">
          <input {...getInputProps()} />
          <p>
            {uploading ? (
              `Uploading... ${progress}%`
            ) : (
              <span>Drag & drop a file here, or click to select a file</span>
            )}
          </p>
        </div>
        {uploadSuccess && uploadedFile && !preprocessedData && (
          <p>Waiting for preprocessing...</p>
        )}
        {error && <p>{error}</p>}
        {preprocessedData && (
          <div className="preprocessed-file">
            <p>File preprocessed successfully:</p>
            <pre>{JSON.stringify(preprocessedData, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  };
  
  export default FileUpload;