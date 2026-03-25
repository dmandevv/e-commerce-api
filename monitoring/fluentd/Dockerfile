FROM fluent/fluentd:v1.16-1

# Install the Elasticsearch output plugin.
# The base image only has file and stdout outputs.
USER root
RUN gem install fluent-plugin-elasticsearch --no-document
USER fluent
